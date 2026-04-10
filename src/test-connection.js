/**
 * Test Supabase Connection
 * Jalankan: node src/test-connection.js
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

async function testConnection() {
  console.log("\n🔌 Testing Supabase connection...\n");
  console.log(`   URL: ${process.env.SUPABASE_URL}`);
  console.log(`   Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)}...`);
  console.log("");

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Test 1: Basic connection
    console.log("📋 Test 1: Koneksi dasar...");
    const { error: pingError } = await supabase.from("categories").select("count").limit(1);

    if (pingError && (pingError.code === "42P01" || pingError.message?.includes("Could not find"))) {
      // Table doesn't exist yet — koneksi berhasil tapi schema belum dijalankan
      console.log("✅ Koneksi ke Supabase BERHASIL!");
      console.log("⚠️  Tabel 'categories' belum ada. Jalankan schema.sql dulu.\n");
      console.log("   📝 Langkah selanjutnya:");
      console.log("   1. Buka Supabase Dashboard → SQL Editor");
      console.log("   2. Copy-paste isi file: src/database/schema.sql");
      console.log("   3. Klik 'Run' untuk membuat tabel");
      console.log("   4. Copy-paste isi file: src/database/seed.sql");
      console.log("   5. Klik 'Run' untuk mengisi data awal\n");
      process.exit(0);
      return;
    }

    if (pingError) {
      throw pingError;
    }

    console.log("✅ Koneksi ke Supabase BERHASIL!");

    // Test 2: Check tables
    console.log("\n📋 Test 2: Cek tabel yang ada...");
    const tablesToCheck = ["categories", "products", "orders", "order_items", "bundles", "bundle_items"];

    for (const table of tablesToCheck) {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });

      if (error) {
        console.log(`   ❌ ${table} — tidak ditemukan`);
      } else {
        console.log(`   ✅ ${table} — ${count} records`);
      }
    }

    // Test 3: Check products data
    console.log("\n📋 Test 3: Coba ambil data produk...");
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("name, price, status")
      .limit(5);

    if (productsError) {
      console.log("   ⚠️  Tidak bisa ambil data produk:", productsError.message);
    } else if (products.length === 0) {
      console.log("   ⚠️  Tabel products kosong. Jalankan seed.sql untuk mengisi data awal.");
    } else {
      console.log(`   ✅ ${products.length} produk ditemukan:`);
      products.forEach((p) => {
        console.log(`      • ${p.name} — Rp ${p.price.toLocaleString("id-ID")} [${p.status}]`);
      });
    }

    console.log("\n🎉 Semua tes selesai! Database siap digunakan.\n");

  } catch (err) {
    console.error("\n❌ Koneksi GAGAL!");
    console.error("   Error:", err.message);
    console.error("\n   Pastikan:");
    console.error("   • SUPABASE_URL benar");
    console.error("   • SUPABASE_SERVICE_ROLE_KEY benar (bukan anon key)");
    console.error("   • Project Supabase aktif\n");
    process.exit(1);
  }
}

testConnection();
