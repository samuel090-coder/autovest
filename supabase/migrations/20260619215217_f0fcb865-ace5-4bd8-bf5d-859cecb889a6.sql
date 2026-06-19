
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies: public read for these buckets, admin write
CREATE POLICY "public read images" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id IN ('investment-images','banners','avatars'));

CREATE POLICY "admin write investment-images" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'investment-images' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'investment-images' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin write banners" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'banners' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "users write own avatar" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
