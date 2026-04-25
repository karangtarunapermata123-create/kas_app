-- =====================================================
-- SCRIPT UNTUK MEMPERBAIKI TABEL EVENTS
-- =====================================================
-- Jalankan script ini untuk menambahkan kolom yang hilang
-- dan memperbaiki struktur tabel events
-- =====================================================

-- 1. Tambahkan kolom yang hilang ke tabel events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS deskripsi text,
ADD COLUMN IF NOT EXISTS period_type text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at bigint;

-- 2. Update kolom updated_at untuk record yang sudah ada (jika NULL)
UPDATE public.events 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 3. Tambahkan constraint untuk period_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'events_period_type_check'
  ) THEN
    ALTER TABLE public.events 
    ADD CONSTRAINT events_period_type_check 
    CHECK (period_type IN ('WEEKLY', 'MONTHLY'));
  END IF;
END $$;

-- 4. Update constraint untuk tipe (dari BULANAN/MINGGUAN/SEKALI ke SEKALI/RUTIN)
-- Pertama, drop constraint lama jika ada
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_tipe_check;

-- Update data yang sudah ada untuk menyesuaikan enum baru
UPDATE public.events 
SET tipe = CASE 
  WHEN tipe IN ('BULANAN', 'MINGGUAN') THEN 'RUTIN'
  WHEN tipe = 'SEKALI' THEN 'SEKALI'
  ELSE 'SEKALI'
END;

-- Tambahkan constraint baru
ALTER TABLE public.events 
ADD CONSTRAINT events_tipe_check 
CHECK (tipe IN ('SEKALI', 'RUTIN'));

-- 5. Set period_type untuk event RUTIN yang sudah ada
UPDATE public.events 
SET period_type = 'MONTHLY' 
WHERE tipe = 'RUTIN' AND period_type IS NULL;

-- 6. Tambahkan index untuk performa
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_tipe ON public.events(tipe);
CREATE INDEX IF NOT EXISTS idx_events_period_type ON public.events(period_type);

-- =====================================================
-- SELESAI
-- =====================================================
-- Tabel events sudah diperbaiki!
-- Sekarang tambah kegiatan arisan tidak akan error lagi.
-- =====================================================