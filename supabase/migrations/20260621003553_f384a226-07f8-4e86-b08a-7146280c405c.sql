
-- Seed banner slots for the login page (image + link only).
INSERT INTO public.banners (key, title, subtitle, link, is_active, sort_order)
VALUES
  ('login_register',     'Register now ₦8,000', 'Withdraw 24/7, money enters your account within 5 minutes.', '/auth', true, 1),
  ('login_app_download', 'Download App',         'Contact customer service for free cash!',                     '/chat', true, 2),
  ('login_support',      'Contact for support and free cash', NULL,                                            '/chat', true, 3),
  ('recharge_hero',      'Recharge',             NULL,                                                          NULL,   true, 4)
ON CONFLICT (key) DO NOTHING;

-- Default editable text for the Recharge page and two welcome announcements.
INSERT INTO public.site_settings (key, value) VALUES
  ('recharge', jsonb_build_object(
    'presets', jsonb_build_array(2800,16000,35000,55000,66000,88000,200000,350000,550000,700000,1000000,2000000),
    'bonus_map', jsonb_build_object('2800','500','16000','1500','35000','3000','55000','1500','66000','2000','88000','3000','200000','10000','350000','25000','550000','60000','700000','80000','1000000','100000','2000000','300000'),
    'instructions', E'1. Enter the amount you wish to invest. The entered amount must match the transfer amount; otherwise, your deposit will not be received.\n\n2. Select a payment method and copy the system account to your mobile banking account.\n\n3. Top up using the account provided by the system.\n\n4. Please enter the correct payment reference number each time you top up.\n\n5. After the transfer is complete, return to the homepage.\n\nYou can use different bank accounts to top up. To avoid delays in fund arrival, please be sure to follow the top-up steps.\n\nIf you have not yet received your top-up funds, you can send the top-up voucher to customer service.',
    'channels', jsonb_build_array(
      jsonb_build_object('name','Shpayr','bank','Opay','account_name','InvestPro Funding','account_number','9012345678','color','#e53935'),
      jsonb_build_object('name','Bank Transfer','bank','Access Bank','account_name','InvestPro Ltd','account_number','0123456789','color','#1565c0')
    )
  )),
  ('announce_1', jsonb_build_object(
    'enabled', true,
    'title', 'Announcement',
    'body', E'1. Cash rewards are distributed daily in the official channel group and are withdrawable.\n\nTelegram: https://t.me/InvestProVip\nWhatsApp Group: https://whatsapp.com/channel/0029\n\n2. After successful investment, customers can enjoy various product discounts. The company is committed to providing the best investment solutions for discerning clients.\n\n3. If you do not see your balance after depositing funds into the system, please contact customer service.'
  )),
  ('announce_2', jsonb_build_object(
    'enabled', true,
    'body', E'Hello, if you are interested in our channel and would like to earn extra income daily, please follow our Telegram channel: https://t.me/InvestProVip. The channel and groups will provide you with the latest news daily. The channel will also occasionally distribute cash rewards.',
    'cta_label', 'Join in',
    'cta_url', 'https://t.me/InvestProVip'
  ))
ON CONFLICT (key) DO NOTHING;
