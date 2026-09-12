-- Create the meal-photos storage bucket (used for meal-scan photos and community post
-- photos) and RLS policies matching the path convention in utils/supabaseStorage.ts
-- (`${userId}/${filename}`). Private bucket: photos are served via signed URLs.
-- This was previously created manually via the Supabase Dashboard and never
-- captured as a migration, so a freshly-provisioned project has no bucket at all.
--
-- Reads are open to any authenticated user (not just the uploader): community feed
-- code (contexts/CommunityContext.tsx) has every viewer call createSignedUrl() on
-- other members' post photos to render the feed, so read access can't be scoped to
-- "own folder only" without breaking that. Writes stay scoped to the caller's own
-- userId/ folder to prevent spoofing/overwriting another user's objects.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-photos',
  'meal-photos',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "meal-photos: users can upload to own folder" ON storage.objects;
CREATE POLICY "meal-photos: users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "meal-photos: any authenticated user can read" ON storage.objects;
CREATE POLICY "meal-photos: any authenticated user can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'meal-photos');

DROP POLICY IF EXISTS "meal-photos: users can update own folder" ON storage.objects;
CREATE POLICY "meal-photos: users can update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "meal-photos: users can delete own folder" ON storage.objects;
CREATE POLICY "meal-photos: users can delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'meal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
