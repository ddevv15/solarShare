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
      allocations: {
        Row: {
          allocated_kwh: number
          community_id: string
          created_at: string
          id: string
          market_interval_id: string
          offer_id: string
          pricing_snapshot_id: string
          reservation_id: string
          scenario_generation_id: string | null
          status: string
          unit_price: number
        }
        Insert: {
          allocated_kwh: number
          community_id: string
          created_at?: string
          id?: string
          market_interval_id: string
          offer_id: string
          pricing_snapshot_id: string
          reservation_id: string
          scenario_generation_id?: string | null
          status?: string
          unit_price: number
        }
        Update: {
          allocated_kwh?: number
          community_id?: string
          created_at?: string
          id?: string
          market_interval_id?: string
          offer_id?: string
          pricing_snapshot_id?: string
          reservation_id?: string
          scenario_generation_id?: string | null
          status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocations_community_id_market_interval_id_offer_id_fkey"
            columns: ["community_id", "market_interval_id", "offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_offer_id_fkey"
            columns: ["community_id", "market_interval_id", "offer_id"]
            isOneToOne: false
            referencedRelation: "own_offers"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_pricing_snapsh_fkey"
            columns: [
              "community_id",
              "market_interval_id",
              "pricing_snapshot_id",
            ]
            isOneToOne: false
            referencedRelation: "pricing_snapshots"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_reservation_id_fkey"
            columns: ["community_id", "market_interval_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "own_reservations"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_reservation_id_fkey"
            columns: ["community_id", "market_interval_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_user_id: string | null
          community_id: string
          details: Json
          event_type: string
          id: string
          occurred_at: string
          request_id: string | null
          subject_id: string | null
          subject_type: string
        }
        Insert: {
          actor_user_id?: string | null
          community_id: string
          details?: Json
          event_type: string
          id?: string
          occurred_at?: string
          request_id?: string | null
          subject_id?: string | null
          subject_type: string
        }
        Update: {
          actor_user_id?: string | null
          community_id?: string
          details?: Json
          event_type?: string
          id?: string
          occurred_at?: string
          request_id?: string | null
          subject_id?: string | null
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_community_id_actor_user_id_fkey"
            columns: ["community_id", "actor_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "audit_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string
          currency: string
          demo_seed_key: string | null
          id: string
          join_code_hash: string | null
          name: string
          seed_version: string | null
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          demo_seed_key?: string | null
          id?: string
          join_code_hash?: string | null
          name: string
          seed_version?: string | null
          status?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          demo_seed_key?: string | null
          id?: string
          join_code_hash?: string | null
          name?: string
          seed_version?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          market_alias: string
          member_role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          market_alias: string
          member_role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          market_alias?: string
          member_role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "own_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          community_id: string
          created_at: string
          currency: string
          id: string
          owner_user_id: string
          status: string
        }
        Insert: {
          community_id: string
          created_at?: string
          currency: string
          id?: string
          owner_user_id: string
          status?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          currency?: string
          id?: string
          owner_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_community_id_owner_user_id_fkey"
            columns: ["community_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
        ]
      }
      data_connections: {
        Row: {
          asset_id: string
          community_id: string
          connection_type: string
          created_at: string
          credentials_ref: string | null
          id: string
          last_error_code: string | null
          last_sync_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          community_id: string
          connection_type: string
          created_at?: string
          credentials_ref?: string | null
          id?: string
          last_error_code?: string | null
          last_sync_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          community_id?: string
          connection_type?: string
          created_at?: string
          credentials_ref?: string | null
          id?: string
          last_error_code?: string | null
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_connections_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "data_connections_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      energy_assets: {
        Row: {
          asset_type: string
          azimuth_degrees: number | null
          capacity_kw: number
          community_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          owner_user_id: string
          reserve_kwh: number
          status: string
          tilt_degrees: number | null
          updated_at: string
          version: number
        }
        Insert: {
          asset_type: string
          azimuth_degrees?: number | null
          capacity_kw: number
          community_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          owner_user_id: string
          reserve_kwh?: number
          status?: string
          tilt_degrees?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          asset_type?: string
          azimuth_degrees?: number | null
          capacity_kw?: number
          community_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          owner_user_id?: string
          reserve_kwh?: number
          status?: string
          tilt_degrees?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "energy_assets_community_id_owner_user_id_fkey"
            columns: ["community_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
        ]
      }
      energy_readings: {
        Row: {
          asset_id: string
          community_id: string
          created_at: string
          data_connection_id: string | null
          id: string
          import_job_id: string | null
          market_interval_id: string
          metric: string
          observed_at: string
          original_unit: string
          original_value: number
          quality: string
          retrieved_at: string
          scenario_generation_id: string | null
          source_record_key: string
          source_type: string
          supersedes_id: string | null
          value_kwh: number
        }
        Insert: {
          asset_id: string
          community_id: string
          created_at?: string
          data_connection_id?: string | null
          id?: string
          import_job_id?: string | null
          market_interval_id: string
          metric: string
          observed_at: string
          original_unit: string
          original_value: number
          quality: string
          retrieved_at?: string
          scenario_generation_id?: string | null
          source_record_key: string
          source_type: string
          supersedes_id?: string | null
          value_kwh: number
        }
        Update: {
          asset_id?: string
          community_id?: string
          created_at?: string
          data_connection_id?: string | null
          id?: string
          import_job_id?: string | null
          market_interval_id?: string
          metric?: string
          observed_at?: string
          original_unit?: string
          original_value?: number
          quality?: string
          retrieved_at?: string
          scenario_generation_id?: string | null
          source_record_key?: string
          source_type?: string
          supersedes_id?: string | null
          value_kwh?: number
        }
        Relationships: [
          {
            foreignKeyName: "energy_readings_community_id_asset_id_data_connection_id_fkey"
            columns: ["community_id", "asset_id", "data_connection_id"]
            isOneToOne: false
            referencedRelation: "data_connections"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_data_connection_id_fkey"
            columns: ["community_id", "asset_id", "data_connection_id"]
            isOneToOne: false
            referencedRelation: "own_connections"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_import_job_id_fkey"
            columns: ["community_id", "asset_id", "import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_import_job_id_fkey"
            columns: ["community_id", "asset_id", "import_job_id"]
            isOneToOne: false
            referencedRelation: "own_imports"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "energy_readings"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "own_readings"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      feeder_snapshots: {
        Row: {
          capacity_kw: number
          community_id: string
          congestion_ratio: number
          created_at: string
          created_by: string | null
          id: string
          load_kw: number
          market_interval_id: string
          observed_at: string
          scenario_generation_id: string | null
          scenario_key: string | null
          source_record_key: string
          source_type: string
        }
        Insert: {
          capacity_kw: number
          community_id: string
          congestion_ratio: number
          created_at?: string
          created_by?: string | null
          id?: string
          load_kw: number
          market_interval_id: string
          observed_at: string
          scenario_generation_id?: string | null
          scenario_key?: string | null
          source_record_key: string
          source_type: string
        }
        Update: {
          capacity_kw?: number
          community_id?: string
          congestion_ratio?: number
          created_at?: string
          created_by?: string | null
          id?: string
          load_kw?: number
          market_interval_id?: string
          observed_at?: string
          scenario_generation_id?: string | null
          scenario_key?: string | null
          source_record_key?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeder_snapshots_community_id_created_by_fkey"
            columns: ["community_id", "created_by"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "feeder_snapshots_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "feeder_snapshots_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      forecasts: {
        Row: {
          asset_id: string
          community_id: string
          confidence_high_kwh: number | null
          confidence_low_kwh: number | null
          created_at: string
          id: string
          issued_at: string
          market_interval_id: string
          metric: string
          model_version: string
          scenario_generation_id: string | null
          source_record_key: string
          source_summary: Json
          source_type: string
          supersedes_id: string | null
          value_kwh: number
        }
        Insert: {
          asset_id: string
          community_id: string
          confidence_high_kwh?: number | null
          confidence_low_kwh?: number | null
          created_at?: string
          id?: string
          issued_at: string
          market_interval_id: string
          metric: string
          model_version: string
          scenario_generation_id?: string | null
          source_record_key: string
          source_summary?: Json
          source_type: string
          supersedes_id?: string | null
          value_kwh: number
        }
        Update: {
          asset_id?: string
          community_id?: string
          confidence_high_kwh?: number | null
          confidence_low_kwh?: number | null
          created_at?: string
          id?: string
          issued_at?: string
          market_interval_id?: string
          metric?: string
          model_version?: string
          scenario_generation_id?: string | null
          source_record_key?: string
          source_summary?: Json
          source_type?: string
          supersedes_id?: string | null
          value_kwh?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "forecasts"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "own_forecasts"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          actor_user_id: string | null
          community_id: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          idempotency_key: string
          operation: string
          request_sha256: string
          result: Json | null
          result_version: string
          status: string
        }
        Insert: {
          actor_user_id?: string | null
          community_id: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key: string
          operation: string
          request_sha256: string
          result?: Json | null
          result_version: string
          status: string
        }
        Update: {
          actor_user_id?: string | null
          community_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string
          operation?: string
          request_sha256?: string
          result?: Json | null
          result_version?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_records_community_id_actor_user_id_fkey"
            columns: ["community_id", "actor_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "idempotency_records_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          accepted_rows: number
          asset_id: string
          committed_at: string | null
          community_id: string
          created_at: string
          file_sha256: string
          id: string
          rejected_rows: number
          status: string
          storage_object_path: string
          updated_at: string
          uploader_user_id: string
          warnings: Json
        }
        Insert: {
          accepted_rows?: number
          asset_id: string
          committed_at?: string | null
          community_id: string
          created_at?: string
          file_sha256: string
          id?: string
          rejected_rows?: number
          status?: string
          storage_object_path: string
          updated_at?: string
          uploader_user_id: string
          warnings?: Json
        }
        Update: {
          accepted_rows?: number
          asset_id?: string
          committed_at?: string | null
          community_id?: string
          created_at?: string
          file_sha256?: string
          id?: string
          rejected_rows?: number
          status?: string
          storage_object_path?: string
          updated_at?: string
          uploader_user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "import_jobs_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "import_jobs_community_id_uploader_user_id_fkey"
            columns: ["community_id", "uploader_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          community_id: string
          created_at: string
          entry_type: string
          id: string
          ledger_transaction_id: string
          scenario_generation_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          community_id: string
          created_at?: string
          entry_type: string
          id?: string
          ledger_transaction_id: string
          scenario_generation_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          community_id?: string
          created_at?: string
          entry_type?: string
          id?: string
          ledger_transaction_id?: string
          scenario_generation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_community_id_account_id_fkey"
            columns: ["community_id", "account_id"]
            isOneToOne: false
            referencedRelation: "credit_accounts"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "ledger_entries_community_id_account_id_fkey"
            columns: ["community_id", "account_id"]
            isOneToOne: false
            referencedRelation: "own_credit_accounts"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "ledger_entries_community_id_ledger_transaction_id_fkey"
            columns: ["community_id", "ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          amount: number
          community_id: string
          created_at: string
          currency: string
          id: string
          posted_at: string
          scenario_generation_id: string | null
          settlement_id: string
        }
        Insert: {
          amount: number
          community_id: string
          created_at?: string
          currency: string
          id?: string
          posted_at: string
          scenario_generation_id?: string | null
          settlement_id: string
        }
        Update: {
          amount?: number
          community_id?: string
          created_at?: string
          currency?: string
          id?: string
          posted_at?: string
          scenario_generation_id?: string | null
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_community_id_settlement_id_fkey"
            columns: ["community_id", "settlement_id"]
            isOneToOne: false
            referencedRelation: "own_settlements"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "ledger_transactions_community_id_settlement_id_fkey"
            columns: ["community_id", "settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      market_intervals: {
        Row: {
          community_id: string
          created_at: string
          id: string
          interval_end: string
          interval_start: string
          scenario_generation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          interval_end: string
          interval_start: string
          scenario_generation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          interval_end?: string
          interval_start?: string
          scenario_generation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intervals_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          auto_adjust: boolean
          batch_id: string | null
          community_id: string
          created_at: string
          forecast_id: string | null
          id: string
          is_manual_quantity: boolean
          market_interval_id: string
          minimum_price: number | null
          quantity_kwh: number
          remaining_kwh: number
          scenario_generation_id: string | null
          seller_user_id: string
          solar_asset_id: string
          status: string
          suggested_price: number | null
          updated_at: string
          version: number
        }
        Insert: {
          auto_adjust?: boolean
          batch_id?: string | null
          community_id: string
          created_at?: string
          forecast_id?: string | null
          id?: string
          is_manual_quantity?: boolean
          market_interval_id: string
          minimum_price?: number | null
          quantity_kwh: number
          remaining_kwh: number
          scenario_generation_id?: string | null
          seller_user_id: string
          solar_asset_id: string
          status?: string
          suggested_price?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          auto_adjust?: boolean
          batch_id?: string | null
          community_id?: string
          created_at?: string
          forecast_id?: string | null
          id?: string
          is_manual_quantity?: boolean
          market_interval_id?: string
          minimum_price?: number | null
          quantity_kwh?: number
          remaining_kwh?: number
          scenario_generation_id?: string | null
          seller_user_id?: string
          solar_asset_id?: string
          status?: string
          suggested_price?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "offers_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "offers_community_id_seller_user_id_fkey"
            columns: ["community_id", "seller_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "offers_community_id_seller_user_id_solar_asset_id_fkey"
            columns: ["community_id", "seller_user_id", "solar_asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "owner_user_id", "id"]
          },
          {
            foreignKeyName: "offers_community_id_solar_asset_id_market_interval_id_fore_fkey"
            columns: [
              "community_id",
              "solar_asset_id",
              "market_interval_id",
              "forecast_id",
            ]
            isOneToOne: false
            referencedRelation: "forecasts"
            referencedColumns: [
              "community_id",
              "asset_id",
              "market_interval_id",
              "id",
            ]
          },
          {
            foreignKeyName: "offers_community_id_solar_asset_id_market_interval_id_fore_fkey"
            columns: [
              "community_id",
              "solar_asset_id",
              "market_interval_id",
              "forecast_id",
            ]
            isOneToOne: false
            referencedRelation: "own_forecasts"
            referencedColumns: [
              "community_id",
              "asset_id",
              "market_interval_id",
              "id",
            ]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          claim_expires_at: string | null
          claim_token: string | null
          claimed_at: string | null
          claimed_by: string | null
          community_id: string
          created_at: string
          delivered_at: string | null
          id: string
          last_error_code: string | null
          payload: Json
          revision: number
          scenario_generation_id: string | null
          status: string
          topic: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempt_count?: number
          available_at?: string
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          community_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error_code?: string | null
          payload?: Json
          revision: number
          scenario_generation_id?: string | null
          status?: string
          topic: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempt_count?: number
          available_at?: string
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          community_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error_code?: string | null
          payload?: Json
          revision?: number
          scenario_generation_id?: string | null
          status?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_snapshots: {
        Row: {
          algorithm_version: string
          community_id: string
          created_at: string
          demand_kwh: number
          explanation: Json
          feeder_snapshot_id: string
          id: string
          market_interval_id: string
          scenario_generation_id: string | null
          supply_kwh: number
          tariff_config_id: string
          unit_price: number
        }
        Insert: {
          algorithm_version: string
          community_id: string
          created_at?: string
          demand_kwh: number
          explanation: Json
          feeder_snapshot_id: string
          id?: string
          market_interval_id: string
          scenario_generation_id?: string | null
          supply_kwh: number
          tariff_config_id: string
          unit_price: number
        }
        Update: {
          algorithm_version?: string
          community_id?: string
          created_at?: string
          demand_kwh?: number
          explanation?: Json
          feeder_snapshot_id?: string
          id?: string
          market_interval_id?: string
          scenario_generation_id?: string | null
          supply_kwh?: number
          tariff_config_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_snapshots_community_id_market_interval_id_feeder_s_fkey"
            columns: [
              "community_id",
              "market_interval_id",
              "feeder_snapshot_id",
            ]
            isOneToOne: false
            referencedRelation: "feeder_snapshots"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "pricing_snapshots_community_id_market_interval_id_feeder_s_fkey"
            columns: [
              "community_id",
              "market_interval_id",
              "feeder_snapshot_id",
            ]
            isOneToOne: false
            referencedRelation: "own_feeders"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "pricing_snapshots_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "pricing_snapshots_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "pricing_snapshots_community_id_tariff_config_id_fkey"
            columns: ["community_id", "tariff_config_id"]
            isOneToOne: false
            referencedRelation: "own_tariffs"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "pricing_snapshots_community_id_tariff_config_id_fkey"
            columns: ["community_id", "tariff_config_id"]
            isOneToOne: false
            referencedRelation: "tariff_configs"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          latitude_approx: number | null
          longitude_approx: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          latitude_approx?: number | null
          longitude_approx?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          latitude_approx?: number | null
          longitude_approx?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          auto_adjust: boolean
          batch_id: string | null
          buyer_user_id: string
          community_id: string
          created_at: string
          id: string
          market_interval_id: string
          maximum_price: number | null
          quantity_kwh: number
          remaining_kwh: number
          scenario_generation_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          auto_adjust?: boolean
          batch_id?: string | null
          buyer_user_id: string
          community_id: string
          created_at?: string
          id?: string
          market_interval_id: string
          maximum_price?: number | null
          quantity_kwh: number
          remaining_kwh: number
          scenario_generation_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          auto_adjust?: boolean
          batch_id?: string | null
          buyer_user_id?: string
          community_id?: string
          created_at?: string
          id?: string
          market_interval_id?: string
          maximum_price?: number | null
          quantity_kwh?: number
          remaining_kwh?: number
          scenario_generation_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_community_id_buyer_user_id_fkey"
            columns: ["community_id", "buyer_user_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "reservations_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "reservations_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      settlement_inputs: {
        Row: {
          community_id: string
          created_at: string
          energy_reading_id: string
          input_kind: string
          scenario_generation_id: string | null
          settlement_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          energy_reading_id: string
          input_kind: string
          scenario_generation_id?: string | null
          settlement_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          energy_reading_id?: string
          input_kind?: string
          scenario_generation_id?: string | null
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_inputs_community_id_energy_reading_id_fkey"
            columns: ["community_id", "energy_reading_id"]
            isOneToOne: false
            referencedRelation: "energy_readings"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "settlement_inputs_community_id_energy_reading_id_fkey"
            columns: ["community_id", "energy_reading_id"]
            isOneToOne: false
            referencedRelation: "own_readings"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "settlement_inputs_community_id_settlement_id_fkey"
            columns: ["community_id", "settlement_id"]
            isOneToOne: false
            referencedRelation: "own_settlements"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "settlement_inputs_community_id_settlement_id_fkey"
            columns: ["community_id", "settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      settlements: {
        Row: {
          allocation_id: string
          community_id: string
          created_at: string
          credit_amount: number
          delivered_kwh: number
          id: string
          scenario_generation_id: string | null
          settled_at: string
          status: string
          unit_price: number
        }
        Insert: {
          allocation_id: string
          community_id: string
          created_at?: string
          credit_amount: number
          delivered_kwh: number
          id?: string
          scenario_generation_id?: string | null
          settled_at: string
          status?: string
          unit_price: number
        }
        Update: {
          allocation_id?: string
          community_id?: string
          created_at?: string
          credit_amount?: number
          delivered_kwh?: number
          id?: string
          scenario_generation_id?: string | null
          settled_at?: string
          status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlements_community_id_allocation_id_fkey"
            columns: ["community_id", "allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "settlements_community_id_allocation_id_fkey"
            columns: ["community_id", "allocation_id"]
            isOneToOne: false
            referencedRelation: "own_allocations"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      tariff_configs: {
        Row: {
          buyer_discount_ratio: number
          community_id: string
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          feed_in_rate: number
          id: string
          retail_rate: number
          seller_margin_ratio: number
        }
        Insert: {
          buyer_discount_ratio?: number
          community_id: string
          created_at?: string
          created_by: string
          effective_from: string
          effective_to?: string | null
          feed_in_rate: number
          id?: string
          retail_rate: number
          seller_margin_ratio?: number
        }
        Update: {
          buyer_discount_ratio?: number
          community_id?: string
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          feed_in_rate?: number
          id?: string
          retail_rate?: number
          seller_margin_ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "tariff_configs_community_id_created_by_fkey"
            columns: ["community_id", "created_by"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "tariff_configs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      own_allocations: {
        Row: {
          allocated_kwh: string | null
          community_id: string | null
          created_at: string | null
          id: string | null
          market_interval_id: string | null
          offer_id: string | null
          pricing_snapshot_id: string | null
          reservation_id: string | null
          status: string | null
          unit_price: string | null
        }
        Insert: {
          allocated_kwh?: never
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          market_interval_id?: string | null
          offer_id?: string | null
          pricing_snapshot_id?: string | null
          reservation_id?: string | null
          status?: string | null
          unit_price?: never
        }
        Update: {
          allocated_kwh?: never
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          market_interval_id?: string | null
          offer_id?: string | null
          pricing_snapshot_id?: string | null
          reservation_id?: string | null
          status?: string | null
          unit_price?: never
        }
        Relationships: [
          {
            foreignKeyName: "allocations_community_id_market_interval_id_offer_id_fkey"
            columns: ["community_id", "market_interval_id", "offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_offer_id_fkey"
            columns: ["community_id", "market_interval_id", "offer_id"]
            isOneToOne: false
            referencedRelation: "own_offers"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_pricing_snapsh_fkey"
            columns: [
              "community_id",
              "market_interval_id",
              "pricing_snapshot_id",
            ]
            isOneToOne: false
            referencedRelation: "pricing_snapshots"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_reservation_id_fkey"
            columns: ["community_id", "market_interval_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "own_reservations"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
          {
            foreignKeyName: "allocations_community_id_market_interval_id_reservation_id_fkey"
            columns: ["community_id", "market_interval_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["community_id", "market_interval_id", "id"]
          },
        ]
      }
      own_assets: {
        Row: {
          asset_type: string | null
          azimuth_degrees: string | null
          capacity_kw: string | null
          community_id: string | null
          created_at: string | null
          id: string | null
          name: string | null
          reserve_kwh: string | null
          status: string | null
          tilt_degrees: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          asset_type?: string | null
          azimuth_degrees?: never
          capacity_kw?: never
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          reserve_kwh?: never
          status?: string | null
          tilt_degrees?: never
          updated_at?: string | null
          version?: never
        }
        Update: {
          asset_type?: string | null
          azimuth_degrees?: never
          capacity_kw?: never
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          reserve_kwh?: never
          status?: string | null
          tilt_degrees?: never
          updated_at?: string | null
          version?: never
        }
        Relationships: []
      }
      own_connections: {
        Row: {
          asset_id: string | null
          community_id: string | null
          connection_type: string | null
          created_at: string | null
          id: string | null
          last_error_code: string | null
          last_sync_at: string | null
          provider: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          community_id?: string | null
          connection_type?: string | null
          created_at?: string | null
          id?: string | null
          last_error_code?: string | null
          last_sync_at?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          community_id?: string | null
          connection_type?: string | null
          created_at?: string | null
          id?: string | null
          last_error_code?: string | null
          last_sync_at?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_connections_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "data_connections_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_credit_accounts: {
        Row: {
          community_id: string | null
          created_at: string | null
          currency: string | null
          id: string | null
          status: string | null
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          status?: string | null
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      own_feeders: {
        Row: {
          capacity_kw: string | null
          community_id: string | null
          congestion_ratio: string | null
          created_at: string | null
          id: string | null
          load_kw: string | null
          market_interval_id: string | null
          observed_at: string | null
          scenario_key: string | null
          source_type: string | null
        }
        Insert: {
          capacity_kw?: never
          community_id?: string | null
          congestion_ratio?: never
          created_at?: string | null
          id?: string | null
          load_kw?: never
          market_interval_id?: string | null
          observed_at?: string | null
          scenario_key?: string | null
          source_type?: string | null
        }
        Update: {
          capacity_kw?: never
          community_id?: string | null
          congestion_ratio?: never
          created_at?: string | null
          id?: string | null
          load_kw?: never
          market_interval_id?: string | null
          observed_at?: string | null
          scenario_key?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feeder_snapshots_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "feeder_snapshots_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_forecasts: {
        Row: {
          asset_id: string | null
          community_id: string | null
          confidence_high_kwh: string | null
          confidence_low_kwh: string | null
          created_at: string | null
          id: string | null
          issued_at: string | null
          market_interval_id: string | null
          metric: string | null
          model_version: string | null
          source_type: string | null
          supersedes_id: string | null
          value_kwh: string | null
        }
        Insert: {
          asset_id?: string | null
          community_id?: string | null
          confidence_high_kwh?: never
          confidence_low_kwh?: never
          created_at?: string | null
          id?: string | null
          issued_at?: string | null
          market_interval_id?: string | null
          metric?: string | null
          model_version?: string | null
          source_type?: string | null
          supersedes_id?: string | null
          value_kwh?: never
        }
        Update: {
          asset_id?: string | null
          community_id?: string | null
          confidence_high_kwh?: never
          confidence_low_kwh?: never
          created_at?: string | null
          id?: string | null
          issued_at?: string | null
          market_interval_id?: string | null
          metric?: string | null
          model_version?: string | null
          source_type?: string | null
          supersedes_id?: string | null
          value_kwh?: never
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "forecasts"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "forecasts_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "own_forecasts"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_imports: {
        Row: {
          accepted_rows: string | null
          asset_id: string | null
          committed_at: string | null
          community_id: string | null
          created_at: string | null
          file_sha256: string | null
          id: string | null
          rejected_rows: string | null
          status: string | null
          updated_at: string | null
          warnings: Json | null
        }
        Insert: {
          accepted_rows?: never
          asset_id?: string | null
          committed_at?: string | null
          community_id?: string | null
          created_at?: string | null
          file_sha256?: string | null
          id?: string | null
          rejected_rows?: never
          status?: string | null
          updated_at?: string | null
          warnings?: Json | null
        }
        Update: {
          accepted_rows?: never
          asset_id?: string | null
          committed_at?: string | null
          community_id?: string | null
          created_at?: string | null
          file_sha256?: string | null
          id?: string | null
          rejected_rows?: never
          status?: string | null
          updated_at?: string | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "import_jobs_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_intervals: {
        Row: {
          community_id: string | null
          created_at: string | null
          id: string | null
          interval_end: string | null
          interval_start: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          interval_end?: string | null
          interval_start?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          interval_end?: string | null
          interval_start?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_intervals_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      own_ledger_entries: {
        Row: {
          account_id: string | null
          amount: string | null
          community_id: string | null
          created_at: string | null
          entry_type: string | null
          id: string | null
          ledger_transaction_id: string | null
          settlement_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_community_id_account_id_fkey"
            columns: ["community_id", "account_id"]
            isOneToOne: false
            referencedRelation: "credit_accounts"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "ledger_entries_community_id_account_id_fkey"
            columns: ["community_id", "account_id"]
            isOneToOne: false
            referencedRelation: "own_credit_accounts"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "ledger_entries_community_id_ledger_transaction_id_fkey"
            columns: ["community_id", "ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_offers: {
        Row: {
          auto_adjust: boolean | null
          batch_id: string | null
          community_id: string | null
          created_at: string | null
          forecast_id: string | null
          id: string | null
          is_manual_quantity: boolean | null
          market_interval_id: string | null
          minimum_price: string | null
          quantity_kwh: string | null
          remaining_kwh: string | null
          solar_asset_id: string | null
          status: string | null
          suggested_price: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          auto_adjust?: boolean | null
          batch_id?: string | null
          community_id?: string | null
          created_at?: string | null
          forecast_id?: string | null
          id?: string | null
          is_manual_quantity?: boolean | null
          market_interval_id?: string | null
          minimum_price?: never
          quantity_kwh?: never
          remaining_kwh?: never
          solar_asset_id?: string | null
          status?: string | null
          suggested_price?: never
          updated_at?: string | null
          version?: never
        }
        Update: {
          auto_adjust?: boolean | null
          batch_id?: string | null
          community_id?: string | null
          created_at?: string | null
          forecast_id?: string | null
          id?: string | null
          is_manual_quantity?: boolean | null
          market_interval_id?: string | null
          minimum_price?: never
          quantity_kwh?: never
          remaining_kwh?: never
          solar_asset_id?: string | null
          status?: string | null
          suggested_price?: never
          updated_at?: string | null
          version?: never
        }
        Relationships: [
          {
            foreignKeyName: "offers_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "offers_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "offers_community_id_solar_asset_id_market_interval_id_fore_fkey"
            columns: [
              "community_id",
              "solar_asset_id",
              "market_interval_id",
              "forecast_id",
            ]
            isOneToOne: false
            referencedRelation: "forecasts"
            referencedColumns: [
              "community_id",
              "asset_id",
              "market_interval_id",
              "id",
            ]
          },
          {
            foreignKeyName: "offers_community_id_solar_asset_id_market_interval_id_fore_fkey"
            columns: [
              "community_id",
              "solar_asset_id",
              "market_interval_id",
              "forecast_id",
            ]
            isOneToOne: false
            referencedRelation: "own_forecasts"
            referencedColumns: [
              "community_id",
              "asset_id",
              "market_interval_id",
              "id",
            ]
          },
        ]
      }
      own_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string | null
          latitude_approx: string | null
          longitude_approx: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          latitude_approx?: never
          longitude_approx?: never
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          latitude_approx?: never
          longitude_approx?: never
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      own_readings: {
        Row: {
          asset_id: string | null
          community_id: string | null
          created_at: string | null
          data_connection_id: string | null
          id: string | null
          import_job_id: string | null
          market_interval_id: string | null
          metric: string | null
          observed_at: string | null
          original_unit: string | null
          original_value: string | null
          quality: string | null
          retrieved_at: string | null
          source_type: string | null
          supersedes_id: string | null
          value_kwh: string | null
        }
        Insert: {
          asset_id?: string | null
          community_id?: string | null
          created_at?: string | null
          data_connection_id?: string | null
          id?: string | null
          import_job_id?: string | null
          market_interval_id?: string | null
          metric?: string | null
          observed_at?: string | null
          original_unit?: string | null
          original_value?: never
          quality?: string | null
          retrieved_at?: string | null
          source_type?: string | null
          supersedes_id?: string | null
          value_kwh?: never
        }
        Update: {
          asset_id?: string | null
          community_id?: string | null
          created_at?: string | null
          data_connection_id?: string | null
          id?: string | null
          import_job_id?: string | null
          market_interval_id?: string | null
          metric?: string | null
          observed_at?: string | null
          original_unit?: string | null
          original_value?: never
          quality?: string | null
          retrieved_at?: string | null
          source_type?: string | null
          supersedes_id?: string | null
          value_kwh?: never
        }
        Relationships: [
          {
            foreignKeyName: "energy_readings_community_id_asset_id_data_connection_id_fkey"
            columns: ["community_id", "asset_id", "data_connection_id"]
            isOneToOne: false
            referencedRelation: "data_connections"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_data_connection_id_fkey"
            columns: ["community_id", "asset_id", "data_connection_id"]
            isOneToOne: false
            referencedRelation: "own_connections"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "energy_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_fkey"
            columns: ["community_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "own_assets"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_import_job_id_fkey"
            columns: ["community_id", "asset_id", "import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_asset_id_import_job_id_fkey"
            columns: ["community_id", "asset_id", "import_job_id"]
            isOneToOne: false
            referencedRelation: "own_imports"
            referencedColumns: ["community_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "energy_readings"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "energy_readings_community_id_supersedes_id_fkey"
            columns: ["community_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "own_readings"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_reservations: {
        Row: {
          auto_adjust: boolean | null
          batch_id: string | null
          community_id: string | null
          created_at: string | null
          id: string | null
          market_interval_id: string | null
          maximum_price: string | null
          quantity_kwh: string | null
          remaining_kwh: string | null
          status: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          auto_adjust?: boolean | null
          batch_id?: string | null
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          market_interval_id?: string | null
          maximum_price?: never
          quantity_kwh?: never
          remaining_kwh?: never
          status?: string | null
          updated_at?: string | null
          version?: never
        }
        Update: {
          auto_adjust?: boolean | null
          batch_id?: string | null
          community_id?: string | null
          created_at?: string | null
          id?: string | null
          market_interval_id?: string | null
          maximum_price?: never
          quantity_kwh?: never
          remaining_kwh?: never
          status?: string | null
          updated_at?: string | null
          version?: never
        }
        Relationships: [
          {
            foreignKeyName: "reservations_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "market_intervals"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "reservations_community_id_market_interval_id_fkey"
            columns: ["community_id", "market_interval_id"]
            isOneToOne: false
            referencedRelation: "own_intervals"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_settlements: {
        Row: {
          allocation_id: string | null
          community_id: string | null
          created_at: string | null
          credit_amount: string | null
          delivered_kwh: string | null
          id: string | null
          settled_at: string | null
          status: string | null
          unit_price: string | null
        }
        Insert: {
          allocation_id?: string | null
          community_id?: string | null
          created_at?: string | null
          credit_amount?: never
          delivered_kwh?: never
          id?: string | null
          settled_at?: string | null
          status?: string | null
          unit_price?: never
        }
        Update: {
          allocation_id?: string | null
          community_id?: string | null
          created_at?: string | null
          credit_amount?: never
          delivered_kwh?: never
          id?: string | null
          settled_at?: string | null
          status?: string | null
          unit_price?: never
        }
        Relationships: [
          {
            foreignKeyName: "settlements_community_id_allocation_id_fkey"
            columns: ["community_id", "allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["community_id", "id"]
          },
          {
            foreignKeyName: "settlements_community_id_allocation_id_fkey"
            columns: ["community_id", "allocation_id"]
            isOneToOne: false
            referencedRelation: "own_allocations"
            referencedColumns: ["community_id", "id"]
          },
        ]
      }
      own_tariffs: {
        Row: {
          buyer_discount_ratio: string | null
          community_id: string | null
          created_at: string | null
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          feed_in_rate: string | null
          id: string | null
          retail_rate: string | null
          seller_margin_ratio: string | null
        }
        Insert: {
          buyer_discount_ratio?: never
          community_id?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          feed_in_rate?: never
          id?: string | null
          retail_rate?: never
          seller_margin_ratio?: never
        }
        Update: {
          buyer_discount_ratio?: never
          community_id?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          feed_in_rate?: never
          id?: string | null
          retail_rate?: never
          seller_margin_ratio?: never
        }
        Relationships: [
          {
            foreignKeyName: "tariff_configs_community_id_created_by_fkey"
            columns: ["community_id", "created_by"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["community_id", "user_id"]
          },
          {
            foreignKeyName: "tariff_configs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_outbox_events: {
        Args: {
          p_claim_ttl_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: Json[]
      }
      create_pricing_snapshot: {
        Args: {
          p_community_id: string
          p_market_interval_id: string
        }
        Returns: Json
      }
      complete_outbox_event: {
        Args: {
          p_claim_token: string
          p_delivered: boolean
          p_error_code?: string
          p_event_id: string
        }
        Returns: Json
      }
      operator_append_feeder_snapshot: {
        Args: {
          p_capacity_kw: number
          p_community_id: string
          p_load_kw: number
          p_market_interval_id: string
          p_observed_at: string
          p_request_id: string
          p_scenario_key: string
          p_source_record_key: string
          p_source_type: string
        }
        Returns: Json
      }
      operator_append_tariff: {
        Args: {
          p_buyer_discount_ratio: number
          p_community_id: string
          p_effective_from: string
          p_effective_to: string
          p_feed_in_rate: number
          p_request_id: string
          p_retail_rate: number
          p_seller_margin_ratio: number
        }
        Returns: Json
      }
      operator_transition_interval: {
        Args: {
          p_community_id: string
          p_market_interval_id: string
          p_request_id: string
          p_target_status: string
        }
        Returns: Json
      }
      operator_update_membership: {
        Args: {
          p_community_id: string
          p_member_role: string
          p_request_id: string
          p_status: string
          p_user_id: string
        }
        Returns: Json
      }
      post_ledger_transaction: {
        Args: {
          p_buyer_account_id: string
          p_community_id: string
          p_idempotency_key: string
          p_seller_account_id: string
          p_settlement_id: string
        }
        Returns: string
      }
      read_action_receipts: {
        Args: { p_after?: Json; p_community_id: string; p_limit?: number }
        Returns: Json[]
      }
      read_community_map: {
        Args: {
          p_after?: Json
          p_community_id: string
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: Json[]
      }
      read_community_marketplace: {
        Args: {
          p_after?: Json
          p_community_id: string
          p_limit?: number
          p_market_interval_id: string
        }
        Returns: Json[]
      }
      read_operator_audit: {
        Args: { p_after?: Json; p_community_id: string; p_limit?: number }
        Returns: Json[]
      }
      read_operator_data_health: {
        Args: {
          p_after?: Json
          p_as_of: string
          p_community_id: string
          p_limit?: number
        }
        Returns: Json[]
      }
      read_operator_market: {
        Args: { p_after?: Json; p_community_id: string; p_limit?: number }
        Returns: Json[]
      }
      read_operator_members: {
        Args: { p_after?: Json; p_community_id: string; p_limit?: number }
        Returns: Json[]
      }
      read_operator_settlement_totals: {
        Args: { p_after?: Json; p_community_id: string; p_limit?: number }
        Returns: Json[]
      }
      read_own_credit_balances: {
        Args: { p_community_id: string }
        Returns: Json[]
      }
      reset_demo_community: {
        Args: {
          p_actor_user_id: string
          p_anchor_date?: string
          p_community_id: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      select_current_forecast: {
        Args: {
          p_as_of: string
          p_asset_id: string
          p_community_id: string
          p_market_interval_id: string
          p_metric: string
        }
        Returns: {
          confidence_high_kwh: string
          confidence_low_kwh: string
          forecast_id: string
          issued_at: string
          model_version: string
          source_type: string
          value_kwh: string
        }[]
      }
      select_preferred_energy_reading: {
        Args: {
          p_asset_id: string
          p_community_id: string
          p_market_interval_id: string
          p_metric: string
        }
        Returns: {
          observed_at: string
          quality: string
          reading_id: string
          retrieved_at: string
          source_type: string
          value_kwh: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
