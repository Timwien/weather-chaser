export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;          // auto-generated: "München → Berchtesgaden"
  stops_json: unknown;   // serialized stop array (Route['stops'])
  date_from: string | null;
  date_to: string | null;
  created_at: string;
}

export interface SavedFinderSearch {
  id: string;
  user_id: string;
  name: string;          // e.g. "Bayern, 3 Tage, Hiking"
  config_json: unknown;  // serialized FinderConfig
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  place_name: string;
  lat: number;
  lng: number;
  created_at: string;
}

/** X3: recent searches (finder or route), newest first, capped per user. */
export interface SearchHistory {
  id: string;
  user_id: string;
  kind: 'finder' | 'route';
  config_json: unknown;  // SavedSearchConfigV1
  created_at: string;
}

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string; // active | trialing | past_due | canceled | inactive
  price_id: string | null;
  current_period_end: string | null;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      subscriptions: {
        Row: Subscription;
        Insert: Subscription;
        Update: Partial<Subscription>;
        Relationships: [];
      };
      saved_routes: {
        Row: SavedRoute;
        Insert: Omit<SavedRoute, 'id' | 'created_at'>;
        Update: Partial<Omit<SavedRoute, 'id' | 'user_id'>>;
        Relationships: [];
      };
      saved_finder_searches: {
        Row: SavedFinderSearch;
        Insert: Omit<SavedFinderSearch, 'id' | 'created_at'>;
        Update: Partial<Omit<SavedFinderSearch, 'id' | 'user_id'>>;
        Relationships: [];
      };
      favorites: {
        Row: Favorite;
        Insert: Omit<Favorite, 'id' | 'created_at'>;
        Update: Partial<Omit<Favorite, 'id' | 'user_id'>>;
        Relationships: [];
      };
      search_history: {
        Row: SearchHistory;
        Insert: Omit<SearchHistory, 'id' | 'created_at'>;
        Update: Partial<Omit<SearchHistory, 'id' | 'user_id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
