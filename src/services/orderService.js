const { randomBytes, randomUUID } = require("crypto");

const supabase = require("../config/supabase");
const {
  getFrontendUrl,
  isPaymentGatewayConfigured,
  isSandboxModeEnabled,
} = require("../config/pakasir");
const {
  cancelPayment,
  createPayment,
  derivePaymentState,
  getPaymentDetail,
  simulatePayment,
} = require("./paymentService");
const { createPaymentAccessToken } = require("../config/security");
const { createHttpError } = require("../utils/respondWithError");
const { fulfillPaidOrder } = require("./fulfillmentService");

const ORDER_SELECT = `
  *,
  order_items(
    *,
    products(name, icon, gradient, price)
  )
`;

const mapOrderItem = (item) => ({
  id: item.id,
  productId: item.product_id,
  name: item.product_name,
  quantity: item.quantity,
  price: item.price,
});

const serializeOrder = (order) => {
  const paymentAccess = createPaymentAccessToken({
    orderId: order.id,
  });

  return {
    id: order.id,
    orderId: order.order_id,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      notes: order.customer_notes || "",
    },
    items: (order.order_items || []).map(mapOrderItem),
    pricing: {
      subtotal: order.total_price,
      fee: order.payment_fee || 0,
      totalPayment: order.payment_total || order.total_price,
    },
    payment: {
      gateway: order.payment_gateway || "pakasir",
      method: order.payment_method || "qris",
      reference: order.payment_ref || null,
      status: order.payment_status || "pending",
      number: order.payment_number || null,
      paymentUrl: order.payment_url || null,
      expiresAt: order.payment_expires_at || null,
      completedAt: order.payment_completed_at || null,
      lastCheckedAt: order.payment_last_checked_at || null,
      sandboxMode: isSandboxModeEnabled(),
    },
    delivery: {
      status: order.fulfillment_status || "pending",
      emailStatus: order.fulfillment_email_status || "pending",
      emailId: order.fulfillment_email_id || null,
      sentAt: order.fulfillment_email_sent_at || null,
      completedAt: order.fulfillment_completed_at || null,
      error: order.fulfillment_error ? "delivery_issue" : null,
    },
    paymentAccess,
  };
};

const sanitizeCustomerField = (value) => String(value || "").trim();

const validateCustomer = ({ customer_name, customer_email, customer_phone }) => {
  if (!customer_name || !customer_email || !customer_phone) {
    throw createHttpError("Data pelanggan wajib diisi lengkap.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    throw createHttpError("Format email tidak valid.");
  }

  if (!/^[\d+\-\s()]{8,}$/.test(customer_phone)) {
    throw createHttpError("Format nomor WhatsApp tidak valid.");
  }
};

const normalizeCheckoutItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError("Minimal ada 1 produk di keranjang.");
  }

  const groupedItems = new Map();

  for (const rawItem of items) {
    const productId = String(rawItem?.product_id || "").trim();
    const quantity = Number(rawItem?.quantity || 0);

    if (!productId) {
      throw createHttpError("Produk pada keranjang tidak valid.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw createHttpError("Jumlah produk harus berupa angka bulat positif.");
    }

    groupedItems.set(productId, (groupedItems.get(productId) || 0) + quantity);
  }

  return Array.from(groupedItems.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(3).toString("hex").toUpperCase();
  return `DSA-${timestamp}-${randomSuffix}`;
};

const fetchProductsForCheckout = async (productIds) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock, status")
    .in("id", productIds);

  if (error) {
    throw error;
  }

  return data || [];
};

const buildPaymentUpdates = (order, payment) => {
  const currentTime = new Date().toISOString();
  const resolvedExpiresAt = payment.expired_at || order.payment_expires_at || null;
  const resolvedCompletedAt =
    payment.completed_at ||
    order.payment_completed_at ||
    (payment.status === "completed" ? currentTime : null);
  const resolvedPaymentUrl = payment.payment_url || order.payment_url || null;
  const resolvedPaymentNumber = payment.payment_number || order.payment_number || null;

  const state = derivePaymentState({
    ...payment,
    expired_at: resolvedExpiresAt,
  });

  return {
    status: state.orderStatus,
    payment_gateway: "pakasir",
    payment_method: payment.payment_method || order.payment_method || "qris",
    payment_ref: payment.order_id || order.payment_ref || order.order_id,
    payment_status: state.paymentStatus,
    payment_number: resolvedPaymentNumber,
    payment_url: resolvedPaymentUrl,
    payment_fee: payment.fee ?? order.payment_fee ?? 0,
    payment_total:
      payment.total_payment ?? order.payment_total ?? order.total_price,
    payment_expires_at: resolvedExpiresAt,
    payment_completed_at: resolvedCompletedAt,
    payment_last_checked_at: currentTime,
    payment_payload: {
      ...payment,
      payment_url: resolvedPaymentUrl,
      payment_number: resolvedPaymentNumber,
      expired_at: resolvedExpiresAt,
      completed_at: resolvedCompletedAt,
    },
    updated_at: currentTime,
  };
};

const getOrderById = async (id) => {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw createHttpError("Pesanan tidak ditemukan.", 404);
    }

    throw error;
  }

  return data;
};

const getOrderByPublicId = async (orderId) => {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_id", orderId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw createHttpError("Pesanan tidak ditemukan.", 404);
    }

    throw error;
  }

  return data;
};

const createCheckoutOrder = async (payload) => {
  if (!isPaymentGatewayConfigured()) {
    const error = createHttpError(
      "Payment gateway Pakasir belum dikonfigurasi. Isi env PAKASIR terlebih dahulu.",
      503
    );
    throw error;
  }

  const customer = {
    customer_name: sanitizeCustomerField(payload.customer_name),
    customer_email: sanitizeCustomerField(payload.customer_email),
    customer_phone: sanitizeCustomerField(payload.customer_phone),
    customer_notes: sanitizeCustomerField(payload.customer_notes),
  };

  validateCustomer(customer);

  const normalizedItems = normalizeCheckoutItems(payload.items);
  const productIds = normalizedItems.map((item) => item.productId);
  const products = await fetchProductsForCheckout(productIds);
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (products.length !== productIds.length) {
    throw createHttpError("Ada produk yang sudah tidak tersedia.");
  }

  const orderItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);

    if (!product || product.status !== "active") {
      throw createHttpError("Ada produk yang tidak aktif atau tidak ditemukan.");
    }

    if (product.stock <= 0) {
      throw createHttpError(`${product.name} sedang habis.`);
    }

    if (item.quantity > product.stock) {
      throw createHttpError(`Stok ${product.name} tidak mencukupi.`);
    }

    return {
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      price: product.price,
    };
  });

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const orderDbId = randomUUID();
  const orderId = generateOrderId();
  const paymentAccess = createPaymentAccessToken({ orderId: orderDbId });
  const redirectUrl = `${getFrontendUrl()}/payment?order=${orderDbId}&token=${encodeURIComponent(
    paymentAccess.token
  )}`;

  let payment = null;
  let createdOrder = null;

  try {
    payment = await createPayment({
      orderId,
      amount: subtotal,
      redirectUrl,
    });

    const { data: insertedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        id: orderDbId,
        order_id: orderId,
        customer_name: customer.customer_name,
        customer_email: customer.customer_email,
        customer_phone: customer.customer_phone,
        customer_notes: customer.customer_notes,
        total_price: subtotal,
        status: "pending",
        payment_gateway: "pakasir",
        payment_method: payment.payment_method,
        payment_ref: payment.order_id,
        payment_status: "pending",
        payment_number: payment.payment_number,
        payment_url: payment.payment_url,
        payment_fee: payment.fee,
        payment_total: payment.total_payment,
        payment_expires_at: payment.expired_at,
        payment_payload: payment,
      })
      .select(ORDER_SELECT)
      .single();

    if (orderError) {
      throw orderError;
    }

    createdOrder = insertedOrder;

    const { error: itemsError } = await supabase.from("order_items").insert(
      orderItems.map((item) => ({
        order_id: orderDbId,
        ...item,
      }))
    );

    if (itemsError) {
      throw itemsError;
    }

    const finalOrder = await getOrderById(orderDbId);
    return serializeOrder(finalOrder);
  } catch (error) {
    if (createdOrder) {
      await supabase.from("orders").delete().eq("id", createdOrder.id);
    }

    if (payment) {
      try {
        await cancelPayment({ orderId, amount: subtotal });
      } catch (cancelError) {
        console.error("Cancel payment rollback error:", cancelError.message);
      }
    }

    throw error;
  }
};

const getPaymentPageOrder = async (id) => {
  const order = await getOrderById(id);
  return serializeOrder(order);
};

const syncOrderPaymentById = async (id) => {
  const order = await getOrderById(id);
  const payment = await getPaymentDetail({
    orderId: order.order_id,
    amount: order.total_price,
  });

  const updates = buildPaymentUpdates(order, payment);

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", order.id)
    .select(ORDER_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (data.payment_status === "completed") {
    await fulfillPaidOrder(data.id);
    const fulfilledOrder = await getOrderById(data.id);
    return serializeOrder(fulfilledOrder);
  }

  return serializeOrder(data);
};

const simulateOrderPaymentById = async (id) => {
  if (!isSandboxModeEnabled()) {
    const error = createHttpError(
      "Simulasi pembayaran hanya diizinkan saat mode sandbox aktif.",
      403
    );
    throw error;
  }

  const order = await getOrderById(id);

  if (order.payment_status && order.payment_status !== "pending") {
    return serializeOrder(order);
  }

  const payment = await simulatePayment({
    orderId: order.order_id,
    amount: order.total_price,
  });

  const updates = buildPaymentUpdates(order, payment);

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", order.id)
    .select(ORDER_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (data.payment_status === "completed") {
    await fulfillPaidOrder(data.id);
    const fulfilledOrder = await getOrderById(data.id);
    return serializeOrder(fulfilledOrder);
  }

  return serializeOrder(data);
};

const handlePakasirWebhook = async (payload) => {
  const orderId = String(payload?.order_id || "").trim();
  const amount = Number(payload?.amount || 0);

  if (!orderId || !amount) {
    throw createHttpError("Webhook Pakasir tidak valid.");
  }

  const order = await getOrderByPublicId(orderId);

  if (order.total_price !== amount) {
    throw createHttpError("Nominal webhook tidak sesuai dengan pesanan.");
  }

  return syncOrderPaymentById(order.id);
};

const retryOrderFulfillmentById = async (id) => {
  const order = await getOrderById(id);

  if (order.payment_status !== "completed") {
    throw createHttpError(
      "Fulfillment hanya bisa dijalankan ulang setelah pembayaran selesai.",
      409
    );
  }

  await fulfillPaidOrder(order.id);
  const updatedOrder = await getOrderById(order.id);
  return serializeOrder(updatedOrder);
};

module.exports = {
  createCheckoutOrder,
  getOrderById,
  getPaymentPageOrder,
  handlePakasirWebhook,
  retryOrderFulfillmentById,
  simulateOrderPaymentById,
  syncOrderPaymentById,
};
