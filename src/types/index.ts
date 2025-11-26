export interface Spool {
  id: number;
  registered: string;
  first_used: string | null;
  last_used: string | null;
  filament: {
    id: number;
    name: string;
    vendor: {
      id: number;
      name: string;
    } | null;
    material: string;
    color_hex: string;
    weight: number;
  };
  remaining_weight: number;
  used_weight: number;
  remaining_length: number | null;
  used_length: number | null;
  location: string | null;
  lot_nr: string | null;
  comment: string;
  archived: boolean;
}

export interface Location {
  id: number;
  name: string;
}
