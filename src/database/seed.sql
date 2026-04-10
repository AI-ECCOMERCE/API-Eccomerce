-- ==============================================
-- DesignAI Store — Seed Data
-- Jalankan SETELAH schema.sql
-- ==============================================

-- Kategori
INSERT INTO categories (name, slug, icon, color) VALUES
  ('AI Chatbot', 'ai-chat', 'ph-robot', 'from-emerald-400 to-teal-500'),
  ('Desain & Kreatif', 'design', 'ph-palette', 'from-violet-400 to-purple-600'),
  ('Produktivitas', 'productivity', 'ph-note-pencil', 'from-blue-400 to-indigo-500'),
  ('Coding & Dev', 'coding', 'ph-code', 'from-slate-600 to-slate-900')
ON CONFLICT (slug) DO NOTHING;

-- Produk
INSERT INTO products (name, description, price, original_price, category_slug, stock, sold, rating, reviews_count, badge_text, badge_color, icon, gradient, shadow, status) VALUES
  ('ChatGPT Plus', 'Akses penuh GPT-4o, DALL-E 3, Code Interpreter & Plugin.', 45000, 320000, 'ai-chat', 50, 342, 5.0, 2400, 'Best Seller', 'bg-green-50 text-green-600', 'ph-robot', 'from-emerald-400 to-teal-500', 'shadow-emerald-500/20', 'active'),
  ('Gemini Advanced', 'Google AI terkuat dengan Gemini Ultra, 2TB storage Google One.', 40000, 310000, 'ai-chat', 35, 256, 5.0, 1800, 'Popular', 'bg-blue-50 text-blue-600', 'ph-sparkle', 'from-blue-400 to-indigo-600', 'shadow-blue-500/20', 'active'),
  ('Canva Pro', '100M+ template premium, Brand Kit, Magic Resize & Background Remover.', 25000, 190000, 'design', 80, 289, 5.0, 3100, 'Hot 🔥', 'bg-purple-50 text-purple-600', 'ph-palette', 'from-violet-400 to-purple-600', 'shadow-purple-500/20', 'active'),
  ('Claude Pro', 'AI Anthropic dengan kemampuan analisis mendalam & konteks 200K token.', 50000, 320000, 'ai-chat', 20, 167, 4.0, 856, 'New ✨', 'bg-amber-50 text-amber-600', 'ph-brain', 'from-amber-400 to-orange-500', 'shadow-orange-500/20', 'active'),
  ('Midjourney', 'AI Image Generator terbaik untuk membuat gambar berkualitas tinggi.', 35000, 160000, 'design', 15, 134, 5.0, 1200, NULL, NULL, 'ph-image-square', 'from-pink-400 to-rose-500', 'shadow-pink-500/20', 'active'),
  ('GitHub Copilot', 'AI pair programmer untuk menulis kode lebih cepat dan efisien.', 30000, 160000, 'coding', 40, 198, 5.0, 967, 'Trending', 'bg-green-50 text-green-600', 'ph-code', 'from-slate-600 to-slate-900', 'shadow-slate-500/20', 'active'),
  ('Notion AI', 'Workspace all-in-one dengan AI assistant untuk produktivitas maksimal.', 25000, 150000, 'productivity', 30, 89, 4.0, 743, NULL, NULL, 'ph-note-pencil', 'from-slate-700 to-slate-900', 'shadow-slate-500/20', 'active'),
  ('Grammarly Premium', 'AI writing assistant untuk grammar, clarity, tone & plagiarism check.', 20000, 200000, 'productivity', 45, 167, 5.0, 1500, NULL, NULL, 'ph-check-circle', 'from-green-400 to-emerald-600', 'shadow-green-500/20', 'active');
