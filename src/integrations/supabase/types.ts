export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      advice_log: {
        Row: {
          action: string | null;
          context: Json | null;
          created_at: string;
          device_id: string;
          id: number;
          language: string;
          message: string;
          source: Database["public"]["Enums"]["advice_source"];
        };
        Insert: {
          action?: string | null;
          context?: Json | null;
          created_at?: string;
          device_id: string;
          id?: number;
          language?: string;
          message: string;
          source?: Database["public"]["Enums"]["advice_source"];
        };
        Update: {
          action?: string | null;
          context?: Json | null;
          created_at?: string;
          device_id?: string;
          id?: number;
          language?: string;
          message?: string;
          source?: Database["public"]["Enums"]["advice_source"];
        };
        Relationships: [
          {
            foreignKeyName: "advice_log_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      alerts: {
        Row: {
          body: string | null;
          channel: Database["public"]["Enums"]["alert_channel"];
          created_at: string;
          device_id: string | null;
          id: number;
          kind: string | null;
          level: Database["public"]["Enums"]["alert_level"];
          read_at: string | null;
          sent_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          channel?: Database["public"]["Enums"]["alert_channel"];
          created_at?: string;
          device_id?: string | null;
          id?: number;
          kind?: string | null;
          level?: Database["public"]["Enums"]["alert_level"];
          read_at?: string | null;
          sent_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          channel?: Database["public"]["Enums"]["alert_channel"];
          created_at?: string;
          device_id?: string | null;
          id?: number;
          kind?: string | null;
          level?: Database["public"]["Enums"]["alert_level"];
          read_at?: string | null;
          sent_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      commands: {
        Row: {
          acked_at: string | null;
          created_at: string;
          device_id: string;
          id: string;
          issued_by: string | null;
          kind: Database["public"]["Enums"]["command_kind"];
          payload: Json;
          status: Database["public"]["Enums"]["command_status"];
        };
        Insert: {
          acked_at?: string | null;
          created_at?: string;
          device_id: string;
          id?: string;
          issued_by?: string | null;
          kind: Database["public"]["Enums"]["command_kind"];
          payload?: Json;
          status?: Database["public"]["Enums"]["command_status"];
        };
        Update: {
          acked_at?: string | null;
          created_at?: string;
          device_id?: string;
          id?: string;
          issued_by?: string | null;
          kind?: Database["public"]["Enums"]["command_kind"];
          payload?: Json;
          status?: Database["public"]["Enums"]["command_status"];
        };
        Relationships: [
          {
            foreignKeyName: "commands_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          claim_code: string | null;
          claimed_at: string | null;
          created_at: string;
          crop: string | null;
          dashboard_widgets: Json;
          device_key: string;
          hardware_id: string | null;
          id: string;
          ip_address: string | null;
          is_claimed: boolean;
          last_seen_at: string | null;
          lat: number | null;
          location_name: string | null;
          lon: number | null;
          name: string;
          online: boolean;
          operator_name: string | null;
          owner_id: string | null;
          pump_off_threshold: number;
          pump_on_threshold: number;
          rain_block_amount_mm: number;
          rain_block_probability: number;
          target_moisture: number;
          updated_at: string;
        };
        Insert: {
          claim_code?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          crop?: string | null;
          dashboard_widgets?: Json;
          device_key: string;
          hardware_id?: string | null;
          id?: string;
          ip_address?: string | null;
          is_claimed?: boolean;
          last_seen_at?: string | null;
          lat?: number | null;
          location_name?: string | null;
          lon?: number | null;
          name: string;
          online?: boolean;
          operator_name?: string | null;
          owner_id?: string | null;
          pump_off_threshold?: number;
          pump_on_threshold?: number;
          rain_block_amount_mm?: number;
          rain_block_probability?: number;
          target_moisture?: number;
          updated_at?: string;
        };
        Update: {
          claim_code?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          crop?: string | null;
          dashboard_widgets?: Json;
          device_key?: string;
          hardware_id?: string | null;
          id?: string;
          ip_address?: string | null;
          is_claimed?: boolean;
          last_seen_at?: string | null;
          lat?: number | null;
          location_name?: string | null;
          lon?: number | null;
          name?: string;
          online?: boolean;
          operator_name?: string | null;
          owner_id?: string | null;
          pump_off_threshold?: number;
          pump_on_threshold?: number;
          rain_block_amount_mm?: number;
          rain_block_probability?: number;
          target_moisture?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      farm_finance: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          currency: string;
          description: string | null;
          device_id: string | null;
          entry_type: string;
          id: string;
          occurred_at: string;
          owner_id: string;
          season: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          category?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          device_id?: string | null;
          entry_type: string;
          id?: string;
          occurred_at?: string;
          owner_id: string;
          season?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          device_id?: string | null;
          entry_type?: string;
          id?: string;
          occurred_at?: string;
          owner_id?: string;
          season?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "farm_finance_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          default_lat: number | null;
          default_location_name: string | null;
          default_lon: number | null;
          full_name: string | null;
          id: string;
          language: string;
          notify_in_app: boolean;
          notify_sms: boolean;
          notify_whatsapp: boolean;
          phone: string | null;
          updated_at: string;
          whatsapp_phone: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          default_lat?: number | null;
          default_location_name?: string | null;
          default_lon?: number | null;
          full_name?: string | null;
          id: string;
          language?: string;
          notify_in_app?: boolean;
          notify_sms?: boolean;
          notify_whatsapp?: boolean;
          phone?: string | null;
          updated_at?: string;
          whatsapp_phone?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          default_lat?: number | null;
          default_location_name?: string | null;
          default_lon?: number | null;
          full_name?: string | null;
          id?: string;
          language?: string;
          notify_in_app?: boolean;
          notify_sms?: boolean;
          notify_whatsapp?: boolean;
          phone?: string | null;
          updated_at?: string;
          whatsapp_phone?: string | null;
        };
        Relationships: [];
      };
      readings: {
        Row: {
          air_humidity: number | null;
          air_temp: number | null;
          device_id: string;
          id: number;
          irrigation_needed: boolean | null;
          pump_on: boolean | null;
          raw: Json | null;
          recorded_at: string;
          soil_moisture: number | null;
          soil_ph: number | null;
          tank_fill_needed: boolean | null;
          valve_on: boolean | null;
          water_deficit: number | null;
          water_level: number | null;
        };
        Insert: {
          air_humidity?: number | null;
          air_temp?: number | null;
          device_id: string;
          id?: number;
          irrigation_needed?: boolean | null;
          pump_on?: boolean | null;
          raw?: Json | null;
          recorded_at?: string;
          soil_moisture?: number | null;
          soil_ph?: number | null;
          tank_fill_needed?: boolean | null;
          valve_on?: boolean | null;
          water_deficit?: number | null;
          water_level?: number | null;
        };
        Update: {
          air_humidity?: number | null;
          air_temp?: number | null;
          device_id?: string;
          id?: number;
          irrigation_needed?: boolean | null;
          pump_on?: boolean | null;
          raw?: Json | null;
          recorded_at?: string;
          soil_moisture?: number | null;
          soil_ph?: number | null;
          tank_fill_needed?: boolean | null;
          valve_on?: boolean | null;
          water_deficit?: number | null;
          water_level?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "readings_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_products: {
        Row: {
          category: string | null;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean;
          name: string;
          price: number;
          stock: number | null;
          supplier_id: string;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name: string;
          price?: number;
          stock?: number | null;
          supplier_id: string;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name?: string;
          price?: number;
          stock?: number | null;
          supplier_id?: string;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          business_name: string;
          created_at: string;
          description: string | null;
          district: string | null;
          id: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          owner_id: string;
          phone: string | null;
          region: string | null;
          updated_at: string;
          village: string | null;
          whatsapp: string | null;
        };
        Insert: {
          business_name: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          owner_id: string;
          phone?: string | null;
          region?: string | null;
          updated_at?: string;
          village?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          business_name?: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          owner_id?: string;
          phone?: string | null;
          region?: string | null;
          updated_at?: string;
          village?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      weather_snapshots: {
        Row: {
          device_id: string;
          forecast_summary: string | null;
          id: number;
          rain_amount_mm: number | null;
          rain_probability: number | null;
          raw: Json | null;
          recorded_at: string;
        };
        Insert: {
          device_id: string;
          forecast_summary?: string | null;
          id?: number;
          rain_amount_mm?: number | null;
          rain_probability?: number | null;
          raw?: Json | null;
          recorded_at?: string;
        };
        Update: {
          device_id?: string;
          forecast_summary?: string | null;
          id?: number;
          rain_amount_mm?: number | null;
          rain_probability?: number | null;
          raw?: Json | null;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weather_snapshots_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_supplier_contact: {
        Args: { _supplier_id: string };
        Returns: {
          phone: string;
          whatsapp: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      advice_source: "ai" | "rules";
      alert_channel: "in_app" | "email" | "sms" | "whatsapp";
      alert_level: "info" | "warning" | "danger";
      app_role: "admin" | "farmer";
      command_kind: "pump_on" | "pump_off" | "valve_on" | "valve_off" | "set_thresholds";
      command_status: "pending" | "sent" | "acked" | "failed" | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      advice_source: ["ai", "rules"],
      alert_channel: ["in_app", "email", "sms", "whatsapp"],
      alert_level: ["info", "warning", "danger"],
      app_role: ["admin", "farmer"],
      command_kind: ["pump_on", "pump_off", "valve_on", "valve_off", "set_thresholds"],
      command_status: ["pending", "sent", "acked", "failed", "expired"],
    },
  },
} as const;
