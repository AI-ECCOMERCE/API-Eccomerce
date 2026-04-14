require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanOrders() {
  console.log("Memulai proses pembersihan data order...");

  // Karena biasanya order_items memiliki foreign key ke orders (ON DELETE CASCADE),
  // kita cukup menghapus dari tabel orders. Jika tidak cascade, hapus order_items dulu.
  
  // 1. Hapus semua order items (opsional jika tidak setup cascade)
  const { error: itemsError } = await supabase
    .from("order_items")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // trick to delete all rows

  if (itemsError) {
    console.error("Gagal menghapus order_items:", itemsError.message);
  } else {
    console.log("✅ Data order_items berhasil dibersihkan");
  }

  // 2. Hapus semua orders
  const { error: ordersError } = await supabase
    .from("orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (ordersError) {
    console.error("Gagal menghapus orders:", ordersError.message);
  } else {
    console.log("✅ Data orders berhasil dibersihkan");
  }

  console.log("Selesai!");
  process.exit(0);
}

cleanOrders();
