const supabase = require("../config/supabase");
const { isEmailDeliveryConfigured } = require("../config/resend");
const { sendOrderDeliveryEmail } = require("./emailService");

const FULFILLMENT_ORDER_SELECT = `
  *,
  order_items(*)
`;

const DELIVERY_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  FULFILLED: "fulfilled",
  MANUAL_REVIEW: "manual_review",
  FAILED: "failed",
};

const EMAIL_STATUSES = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
};

const getFulfillmentOrderById = async (orderId) => {
  const { data, error } = await supabase
    .from("orders")
    .select(FULFILLMENT_ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const setOrderFulfillmentState = async (orderId, updates) => {
  const { error } = await supabase
    .from("orders")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    throw error;
  }
};

const tryStartFulfillment = async (orderId) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({
      fulfillment_status: DELIVERY_STATUSES.PROCESSING,
      fulfillment_started_at: now,
      fulfillment_error: null,
      updated_at: now,
    })
    .eq("id", orderId)
    .in("fulfillment_status", [
      DELIVERY_STATUSES.PENDING,
      DELIVERY_STATUSES.FAILED,
      DELIVERY_STATUSES.MANUAL_REVIEW,
    ])
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
};

const getAssignedAccountsForOrderItem = async (orderItemId) => {
  const { data, error } = await supabase
    .from("product_accounts")
    .select(
      "id, product_id, account_name, login_email, login_password, account_notes, status"
    )
    .eq("assigned_order_item_id", orderItemId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

const claimAccountForOrderItem = async ({ productId, orderId, orderItemId }) => {
  const { data, error } = await supabase.rpc("claim_product_account", {
    p_product_id: productId,
    p_order_id: orderId,
    p_order_item_id: orderItemId,
  });

  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
};

const markAccountsDelivered = async (orderId) => {
  const deliveredAt = new Date().toISOString();
  const { error } = await supabase
    .from("product_accounts")
    .update({
      status: "delivered",
      delivered_at: deliveredAt,
      updated_at: deliveredAt,
    })
    .eq("assigned_order_id", orderId)
    .eq("status", "reserved");

  if (error) {
    throw error;
  }
};

const applyProductSales = async (productId, quantity) => {
  const { error } = await supabase.rpc("apply_product_sales", {
    p_product_id: productId,
    p_quantity: quantity,
  });

  if (error) {
    throw error;
  }
};

const buildDeliveryGroups = async (order) => {
  const groups = [];

  for (const item of order.order_items || []) {
    const assignedAccounts = await getAssignedAccountsForOrderItem(item.id);
    const missingCount = Math.max(0, Number(item.quantity || 0) - assignedAccounts.length);

    for (let index = 0; index < missingCount; index += 1) {
      const claimedAccount = await claimAccountForOrderItem({
        productId: item.product_id,
        orderId: order.id,
        orderItemId: item.id,
      });

      if (!claimedAccount) {
        return {
          success: false,
          message: `Inventori akun untuk ${item.product_name} tidak mencukupi.`,
        };
      }

      assignedAccounts.push(claimedAccount);
    }

    groups.push({
      productName: item.product_name,
      quantity: item.quantity,
      accounts: assignedAccounts,
    });
  }

  return {
    success: true,
    groups,
  };
};

const markManualReview = async (orderId, message) => {
  await setOrderFulfillmentState(orderId, {
    fulfillment_status: DELIVERY_STATUSES.MANUAL_REVIEW,
    fulfillment_email_status: EMAIL_STATUSES.PENDING,
    fulfillment_error: message,
  });
};

const markFulfillmentFailed = async (orderId, message) => {
  await setOrderFulfillmentState(orderId, {
    fulfillment_status: DELIVERY_STATUSES.FAILED,
    fulfillment_email_status: EMAIL_STATUSES.FAILED,
    fulfillment_error: message,
  });
};

const markFulfillmentSuccess = async (order, emailId) => {
  const completedAt = new Date().toISOString();

  await setOrderFulfillmentState(order.id, {
    status: "completed",
    fulfillment_status: DELIVERY_STATUSES.FULFILLED,
    fulfillment_completed_at: completedAt,
    fulfillment_email_status: EMAIL_STATUSES.SENT,
    fulfillment_email_id: emailId || null,
    fulfillment_email_sent_at: completedAt,
    fulfillment_error: null,
  });
};

const fulfillPaidOrder = async (orderId) => {
  const order = await getFulfillmentOrderById(orderId);

  if (order.payment_status !== "completed") {
    return order;
  }

  if (
    order.fulfillment_status === DELIVERY_STATUSES.FULFILLED &&
    order.fulfillment_email_status === EMAIL_STATUSES.SENT
  ) {
    return order;
  }

  if (!isEmailDeliveryConfigured()) {
    await markManualReview(
      order.id,
      "Email otomatis belum aktif. Isi konfigurasi Resend terlebih dahulu."
    );
    return getFulfillmentOrderById(order.id);
  }

  const started = await tryStartFulfillment(order.id);

  if (!started) {
    return getFulfillmentOrderById(order.id);
  }

  try {
    const deliveryResult = await buildDeliveryGroups(order);

    if (!deliveryResult.success) {
      await markManualReview(order.id, deliveryResult.message);
      return getFulfillmentOrderById(order.id);
    }

    const emailResult = await sendOrderDeliveryEmail({
      order,
      deliveryGroups: deliveryResult.groups,
    });

    await markAccountsDelivered(order.id);

    for (const item of order.order_items || []) {
      if (item.product_id) {
        await applyProductSales(item.product_id, item.quantity);
      }
    }

    await markFulfillmentSuccess(order, emailResult?.id || null);
    return getFulfillmentOrderById(order.id);
  } catch (error) {
    console.error("Order fulfillment error:", error.message);
    await markFulfillmentFailed(
      order.id,
      error.message || "Fulfillment email gagal diproses."
    );
    return getFulfillmentOrderById(order.id);
  }
};

module.exports = {
  fulfillPaidOrder,
};
