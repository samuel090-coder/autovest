export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_number: string
          bank_name: string
          created_at: string
          holder_name: string
          id: string
          is_default: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          bank_name: string
          created_at?: string
          holder_name: string
          id?: string
          is_default?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          bank_name?: string
          created_at?: string
          holder_name?: string
          id?: string
          is_default?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          id: string
          image_url: string | null
          is_active: boolean
          key: string
          link: string | null
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          image_url?: string | null
          is_active?: boolean
          key: string
          link?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string | null
          is_active?: boolean
          key?: string
          link?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      free_cash_codes: {
        Row: {
          amount: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number
          redeemed_count: number
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number
          redeemed_count?: number
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number
          redeemed_count?: number
        }
        Relationships: []
      }
      free_cash_redemptions: {
        Row: {
          amount: number
          code_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          code_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          code_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_cash_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "free_cash_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          category: Database["public"]["Enums"]["investment_category"]
          created_at: string
          cycle_days: number
          daily_income: number
          description: string | null
          flash_sale_discount_pct: number | null
          flash_sale_price: number | null
          flash_sale_route: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_flash_sale: boolean
          is_hot: boolean
          max_rounds: number
          name: string
          price: number
          sort_order: number
          total_income: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["investment_category"]
          created_at?: string
          cycle_days: number
          daily_income: number
          description?: string | null
          flash_sale_discount_pct?: number | null
          flash_sale_price?: number | null
          flash_sale_route?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_flash_sale?: boolean
          is_hot?: boolean
          max_rounds?: number
          name: string
          price: number
          sort_order?: number
          total_income: number
        }
        Update: {
          category?: Database["public"]["Enums"]["investment_category"]
          created_at?: string
          cycle_days?: number
          daily_income?: number
          description?: string | null
          flash_sale_discount_pct?: number | null
          flash_sale_price?: number | null
          flash_sale_route?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_flash_sale?: boolean
          is_hot?: boolean
          max_rounds?: number
          name?: string
          price?: number
          sort_order?: number
          total_income?: number
        }
        Relationships: []
      }
      lucky_draw_spins: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      lucky_draw_state: {
        Row: {
          base_spins: number
          bonus_spins: number
          claimed_at: string | null
          created_at: string
          expires_at: string
          goal_amount: number
          lottery_balance: number
          referral_target: number
          referrals_counted: number
          spins_used: number
          total_won: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_spins?: number
          bonus_spins?: number
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          goal_amount?: number
          lottery_balance?: number
          referral_target?: number
          referrals_counted?: number
          spins_used?: number
          total_won?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_spins?: number
          bonus_spins?: number
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          goal_amount?: number
          lottery_balance?: number
          referral_target?: number
          referrals_counted?: number
          spins_used?: number
          total_won?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
          source_transaction_id: string | null
          tier: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
          source_transaction_id?: string | null
          tier?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          source_transaction_id?: string | null
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_investments: {
        Row: {
          claimed_at: string | null
          collected_income: number
          completed_at: string | null
          cycle_days: number
          daily_income: number
          id: string
          investment_id: string
          last_collected_at: string | null
          price_paid: number
          purchased_at: string
          quantity: number
          round: number
          status: string
          total_income: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          collected_income?: number
          completed_at?: string | null
          cycle_days: number
          daily_income: number
          id?: string
          investment_id: string
          last_collected_at?: string | null
          price_paid: number
          purchased_at?: string
          quantity?: number
          round?: number
          status?: string
          total_income: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          collected_income?: number
          completed_at?: string | null
          cycle_days?: number
          daily_income?: number
          id?: string
          investment_id?: string
          last_collected_at?: string | null
          price_paid?: number
          purchased_at?: string
          quantity?: number
          round?: number
          status?: string
          total_income?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_investments_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          cumulative_income: number
          referral_bonus: number
          team_size: number
          total_withdrawals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          cumulative_income?: number
          referral_bonus?: number
          team_size?: number
          total_withdrawals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          cumulative_income?: number
          referral_bonus?: number
          team_size?: number
          total_withdrawals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_proofs: {
        Row: {
          amount: number
          caption: string
          created_at: string
          id: string
          image_url: string | null
          is_ai: boolean
          phone_masked: string
          user_id: string | null
        }
        Insert: {
          amount: number
          caption: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_ai?: boolean
          phone_masked: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          caption?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_ai?: boolean
          phone_masked?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_investment: { Args: { _uinv_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lucky_claim: { Args: never; Returns: Json }
      lucky_spin: { Args: never; Returns: Json }
      lucky_sync_referrals: { Args: never; Returns: Json }
      redeem_free_cash: { Args: { _code: string }; Returns: Json }
      start_next_round: { Args: { _uinv_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      investment_category: "welfare" | "product"
      transaction_status: "pending" | "approved" | "rejected"
      transaction_type:
        | "recharge"
        | "withdraw"
        | "invest"
        | "income"
        | "referral"
        | "claim"
        | "bonus"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      investment_category: ["welfare", "product"],
      transaction_status: ["pending", "approved", "rejected"],
      transaction_type: [
        "recharge",
        "withdraw",
        "invest",
        "income",
        "referral",
        "claim",
        "bonus",
      ],
    },
  },
} as const
