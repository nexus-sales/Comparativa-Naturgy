export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  is_approved: boolean;
  is_blocked: boolean | null;
  last_login_at: string | null;
  accepted_terms_at: string | null;
}

export interface Segment {
  id: string;
  label: string;
  tax_model: string;
  pot_p: number;
  bono_rate: number;
  excedente_rate: number;
  tax_imp_elec: number;
  tax_igic: number;
  tax_igic_red: number;
  tax_igic_7: number;
}

export interface Tariff {
  id: string;
  segment_id: string;
  name: string;
  type: string;
  pot_unit: string;
  r_pot: number[];
  r_en: number[];
  sva: number;
  requires_auth?: boolean;
  is_active?: boolean;
}

export interface Notice {
  id: string;
  type: 'tarifa' | 'servicio' | 'noticia';
  title: string;
  body: string;
  effective_date: string | null;
  expires_at: string | null;
  is_highlighted: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalculationData {
  saving?: number;
  segment?: string;
  tax_model?: string;
  pot_prices?: number;
  best_tariff?: string;
  available_tariffs?: unknown[];
  client_data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ClientComparison {
  id: string;
  user_id: string;
  client_name: string | null;
  client_email: string | null;
  client_address: string | null;
  target_tariff: string | null;
  target_segment: string | null;
  calculation_data: CalculationData;
  deleted_by_user: boolean;
  created_at: string;
  profiles?: {
    email: string | null;
    full_name: string | null;
    phone: string | null;
  } | null;
}
