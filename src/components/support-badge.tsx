import { Link } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SupportBadge() {
  const { data: banner } = useQuery({
    queryKey: ["banner", "support_badge"],
    queryFn: async () => {
      const { data } = await supabase.from("banners").select("image_url,link").eq("key", "support_badge").maybeSingle();
      return data;
    },
  });
  const link = banner?.link ?? "/chat";
  return (
    <Link
      to={link}
      className="fixed bottom-24 right-3 z-40 grid h-14 w-14 place-items-center rounded-full border-2 border-info bg-card shadow-lg"
      aria-label="Customer Service"
    >
      {banner?.image_url ? (
        <img src={banner.image_url} alt="Support" className="h-14 w-14 rounded-full object-cover" />
      ) : (
        <HelpCircle className="h-6 w-6 text-info" />
      )}
    </Link>
  );
}
