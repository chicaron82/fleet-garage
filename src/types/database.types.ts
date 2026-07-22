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
      audits: {
        Row: {
          auditor_id: string
          auditor_name: string
          branch_id: string
          created_at: string
          crew: Json
          date: string
          id: string
          owning_area: string
          plate: string
          sections: Json
          status: string
          vehicle_number: string
        }
        Insert: {
          auditor_id: string
          auditor_name: string
          branch_id: string
          created_at?: string
          crew: Json
          date: string
          id?: string
          owning_area: string
          plate: string
          sections: Json
          status: string
          vehicle_number: string
        }
        Update: {
          auditor_id?: string
          auditor_name?: string
          branch_id?: string
          created_at?: string
          crew?: Json
          date?: string
          id?: string
          owning_area?: string
          plate?: string
          sections?: Json
          status?: string
          vehicle_number?: string
        }
        Relationships: []
      }
      branch_settings: {
        Row: {
          id: number
          peak_season: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          peak_season?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          peak_season?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      effie_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "effie_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      effie_pending_writes: {
        Row: {
          created_at: string
          id: string
          kind: string
          photos: Json | null
          proposal: Json
          proposed_by: string
          reject_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          would_auto_clear: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          photos?: Json | null
          proposal: Json
          proposed_by: string
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          would_auto_clear?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          photos?: Json | null
          proposal?: Json
          proposed_by?: string
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          would_auto_clear?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "effie_pending_writes_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effie_pending_writes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      effie_threads: {
        Row: {
          thread: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          thread: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          thread?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ev_asset_loans: {
        Row: {
          asset_type: string
          borrower_unit: string
          created_at: string
          created_by: string | null
          id: string
          lender_vehicle_id: string
          notes: string | null
          returned_at: string | null
          returned_by: string | null
          status: string
        }
        Insert: {
          asset_type: string
          borrower_unit: string
          created_at?: string
          created_by?: string | null
          id?: string
          lender_vehicle_id: string
          notes?: string | null
          returned_at?: string | null
          returned_by?: string | null
          status?: string
        }
        Update: {
          asset_type?: string
          borrower_unit?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lender_vehicle_id?: string
          notes?: string | null
          returned_at?: string | null
          returned_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ev_asset_loans_lender_vehicle_id_fkey"
            columns: ["lender_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ev_asset_updates: {
        Row: {
          adapter_status: string | null
          cable_status: string | null
          created_at: string
          id: string
          notes: string | null
          source: string
          updated_by: string
          vehicle_id: string
        }
        Insert: {
          adapter_status?: string | null
          cable_status?: string | null
          created_at?: string
          id: string
          notes?: string | null
          source: string
          updated_by: string
          vehicle_id: string
        }
        Update: {
          adapter_status?: string | null
          cable_status?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          updated_by?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ev_asset_updates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_issues: {
        Row: {
          branch_id: string
          cleared_at: string | null
          cleared_by: string | null
          description: string | null
          id: string
          notes: string | null
          photo_url: string | null
          reopen_count: number
          reported_at: string
          reported_by: string
          severity: string
          status: string
          title: string
        }
        Insert: {
          branch_id: string
          cleared_at?: string | null
          cleared_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          reopen_count?: number
          reported_at?: string
          reported_by: string
          severity?: string
          status?: string
          title: string
        }
        Update: {
          branch_id?: string
          cleared_at?: string | null
          cleared_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          reopen_count?: number
          reported_at?: string
          reported_by?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      fleet_balance: {
        Row: {
          date: string
          entered_at: string | null
          entered_by: string
          id: string
          in_count: number
          out_count: number
        }
        Insert: {
          date: string
          entered_at?: string | null
          entered_by: string
          id?: string
          in_count: number
          out_count: number
        }
        Update: {
          date?: string
          entered_at?: string | null
          entered_by?: string
          id?: string
          in_count?: number
          out_count?: number
        }
        Relationships: []
      }
      fuel_pump_readings: {
        Row: {
          branch_id: string
          created_at: string
          date: string
          digital_close: number | null
          digital_open: number | null
          id: string
          logged_by_id: string | null
          logged_by_name: string | null
          pump1_close: number | null
          pump1_open: number | null
          pump2_reading: number | null
          topup_note: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          date: string
          digital_close?: number | null
          digital_open?: number | null
          id?: string
          logged_by_id?: string | null
          logged_by_name?: string | null
          pump1_close?: number | null
          pump1_open?: number | null
          pump2_reading?: number | null
          topup_note?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          date?: string
          digital_close?: number | null
          digital_open?: number | null
          id?: string
          logged_by_id?: string | null
          logged_by_name?: string | null
          pump1_close?: number | null
          pump1_open?: number | null
          pump2_reading?: number | null
          topup_note?: string | null
        }
        Relationships: []
      }
      geotab_watchlist: {
        Row: {
          added_at: string
          installed_at: string | null
          installed_by: string | null
          plate: string
        }
        Insert: {
          added_at?: string
          installed_at?: string | null
          installed_by?: string | null
          plate: string
        }
        Update: {
          added_at?: string
          installed_at?: string | null
          installed_by?: string | null
          plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "geotab_watchlist_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_notes: {
        Row: {
          airport_flipping: boolean
          branch_id: string
          carry_over_cleared: number
          full_pages: number
          id: string
          last_page_entries: number
          logged_at: string
          logged_by: string
          logged_by_name: string
          lot_status: string
          morning_hours: number
          notes: string | null
          team_size: number
        }
        Insert: {
          airport_flipping?: boolean
          branch_id: string
          carry_over_cleared?: number
          full_pages?: number
          id?: string
          last_page_entries?: number
          logged_at?: string
          logged_by: string
          logged_by_name: string
          lot_status?: string
          morning_hours?: number
          notes?: string | null
          team_size?: number
        }
        Update: {
          airport_flipping?: boolean
          branch_id?: string
          carry_over_cleared?: number
          full_pages?: number
          id?: string
          last_page_entries?: number
          logged_at?: string
          logged_by?: string
          logged_by_name?: string
          lot_status?: string
          morning_hours?: number
          notes?: string | null
          team_size?: number
        }
        Relationships: []
      }
      holds: {
        Row: {
          branch_id: string
          cleaned_inhouse_logged_at: string | null
          created_at: string | null
          damage_description: string
          detail_reason: string | null
          flagged_at: string
          flagged_by_employee_id: string | null
          flagged_by_id: string
          flagged_by_name: string | null
          flagged_source: string | null
          hold_type: string
          hold_types: string[] | null
          id: string
          linked_hold_id: string | null
          mechanical_sub_type: string | null
          notes: string
          offstandard_linked: boolean | null
          photos: string[]
          resolved_types: string[]
          status: string
          vehicle_id: string
        }
        Insert: {
          branch_id?: string
          cleaned_inhouse_logged_at?: string | null
          created_at?: string | null
          damage_description: string
          detail_reason?: string | null
          flagged_at: string
          flagged_by_employee_id?: string | null
          flagged_by_id: string
          flagged_by_name?: string | null
          flagged_source?: string | null
          hold_type?: string
          hold_types?: string[] | null
          id: string
          linked_hold_id?: string | null
          mechanical_sub_type?: string | null
          notes?: string
          offstandard_linked?: boolean | null
          photos?: string[]
          resolved_types?: string[]
          status: string
          vehicle_id: string
        }
        Update: {
          branch_id?: string
          cleaned_inhouse_logged_at?: string | null
          created_at?: string | null
          damage_description?: string
          detail_reason?: string | null
          flagged_at?: string
          flagged_by_employee_id?: string | null
          flagged_by_id?: string
          flagged_by_name?: string | null
          flagged_source?: string | null
          hold_type?: string
          hold_types?: string[] | null
          id?: string
          linked_hold_id?: string | null
          mechanical_sub_type?: string | null
          notes?: string
          offstandard_linked?: boolean | null
          photos?: string[]
          resolved_types?: string[]
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holds_linked_hold_id_fkey"
            columns: ["linked_hold_id"]
            isOneToOne: false
            referencedRelation: "holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holds_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sessions: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          entry_data: Json
          exported_at: string | null
          id: string
          session_date: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          entry_data?: Json
          exported_at?: string | null
          id?: string
          session_date?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          entry_data?: Json
          exported_at?: string | null
          id?: string
          session_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      issue_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          issue_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          issue_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          issue_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "facility_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_found: {
        Row: {
          branch_id: string
          description: string | null
          edited_at: string | null
          edited_by_name: string | null
          found_at: string
          found_by: string
          found_by_name: string
          id: string
          item_photo: string | null
          key_tag_photo: string | null
          license_plate: string | null
          location: string | null
          notes: string | null
          resolved_at: string | null
          status: string
          unit_number: string | null
          vehicle_make: string | null
        }
        Insert: {
          branch_id: string
          description?: string | null
          edited_at?: string | null
          edited_by_name?: string | null
          found_at?: string
          found_by: string
          found_by_name: string
          id?: string
          item_photo?: string | null
          key_tag_photo?: string | null
          license_plate?: string | null
          location?: string | null
          notes?: string | null
          resolved_at?: string | null
          status?: string
          unit_number?: string | null
          vehicle_make?: string | null
        }
        Update: {
          branch_id?: string
          description?: string | null
          edited_at?: string | null
          edited_by_name?: string | null
          found_at?: string
          found_by?: string
          found_by_name?: string
          id?: string
          item_photo?: string | null
          key_tag_photo?: string | null
          license_plate?: string | null
          location?: string | null
          notes?: string | null
          resolved_at?: string | null
          status?: string
          unit_number?: string | null
          vehicle_make?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          branch_id: string
          created_at: string
          icon: string
          id: string
          is_read: boolean
          metadata: Json | null
          read_by: string[]
          recipient_roles: string[]
          recipient_user_id: string | null
          severity: string
          text: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          icon: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_by?: string[]
          recipient_roles: string[]
          recipient_user_id?: string | null
          severity?: string
          text: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          icon?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_by?: string[]
          recipient_roles?: string[]
          recipient_user_id?: string | null
          severity?: string
          text?: string
        }
        Relationships: []
      }
      off_standard_entries: {
        Row: {
          auto_from_trip: boolean
          backdate_approved_at: string | null
          backdate_approved_by: string | null
          branch_id: string
          created_at: string
          date: string
          edit_requested_at: string | null
          edit_requested_by: string | null
          edit_reviewed_at: string | null
          edit_reviewed_by: string | null
          edit_staff_note: string | null
          edit_status: string | null
          edited_end_time: string | null
          edv_exterior: boolean
          edv_interior: boolean
          edv_plate: string | null
          explanation: string | null
          id: string
          is_backdated: boolean | null
          linked_hold_id: string | null
          minutes: number | null
          preset_reason: string | null
          reason: string
          start_time: string
          status: string
          stop_time: string | null
          user_id: string
        }
        Insert: {
          auto_from_trip?: boolean
          backdate_approved_at?: string | null
          backdate_approved_by?: string | null
          branch_id?: string
          created_at?: string
          date: string
          edit_requested_at?: string | null
          edit_requested_by?: string | null
          edit_reviewed_at?: string | null
          edit_reviewed_by?: string | null
          edit_staff_note?: string | null
          edit_status?: string | null
          edited_end_time?: string | null
          edv_exterior?: boolean
          edv_interior?: boolean
          edv_plate?: string | null
          explanation?: string | null
          id?: string
          is_backdated?: boolean | null
          linked_hold_id?: string | null
          minutes?: number | null
          preset_reason?: string | null
          reason: string
          start_time: string
          status?: string
          stop_time?: string | null
          user_id: string
        }
        Update: {
          auto_from_trip?: boolean
          backdate_approved_at?: string | null
          backdate_approved_by?: string | null
          branch_id?: string
          created_at?: string
          date?: string
          edit_requested_at?: string | null
          edit_requested_by?: string | null
          edit_reviewed_at?: string | null
          edit_reviewed_by?: string | null
          edit_staff_note?: string | null
          edit_status?: string | null
          edited_end_time?: string | null
          edv_exterior?: boolean
          edv_interior?: boolean
          edv_plate?: string | null
          explanation?: string | null
          id?: string
          is_backdated?: boolean | null
          linked_hold_id?: string | null
          minutes?: number | null
          preset_reason?: string | null
          reason?: string
          start_time?: string
          status?: string
          stop_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "off_standard_entries_linked_hold_id_fkey"
            columns: ["linked_hold_id"]
            isOneToOne: false
            referencedRelation: "holds"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_events: {
        Row: {
          created_at: string
          event_date: string
          event_time: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_time?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_time?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch_id: string
          created_at: string
          employee_id: string
          id: string
          name: string
          quick_start_order: string[] | null
          role: string
          roster_only: boolean
          utility: boolean
        }
        Insert: {
          branch_id: string
          created_at?: string
          employee_id: string
          id: string
          name: string
          quick_start_order?: string[] | null
          role: string
          roster_only?: boolean
          utility?: boolean
        }
        Update: {
          branch_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          name?: string
          quick_start_order?: string[] | null
          role?: string
          roster_only?: boolean
          utility?: boolean
        }
        Relationships: []
      }
      releases: {
        Row: {
          actual_return: string | null
          approved_at: string
          approved_by_id: string
          created_at: string | null
          expected_return: string | null
          hold_id: string
          id: string
          notes: string
          override_authorization: string | null
          reason: string
          release_method: string
          release_type: string
        }
        Insert: {
          actual_return?: string | null
          approved_at: string
          approved_by_id: string
          created_at?: string | null
          expected_return?: string | null
          hold_id: string
          id: string
          notes?: string
          override_authorization?: string | null
          reason: string
          release_method?: string
          release_type?: string
        }
        Update: {
          actual_return?: string | null
          approved_at?: string
          approved_by_id?: string
          created_at?: string | null
          expected_return?: string | null
          hold_id?: string
          id?: string
          notes?: string
          override_authorization?: string | null
          reason?: string
          release_method?: string
          release_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "holds"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          created_at: string
          hold_id: string
          id: string
          notes: string
          outcome: string
          repaired_at: string
          repaired_by_id: string
        }
        Insert: {
          created_at?: string
          hold_id: string
          id: string
          notes?: string
          outcome?: string
          repaired_at: string
          repaired_by_id: string
        }
        Update: {
          created_at?: string
          hold_id?: string
          id?: string
          notes?: string
          outcome?: string
          repaired_at?: string
          repaired_by_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repairs_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "holds"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_checkpoints: {
        Row: {
          branch_id: string
          checkpoint_type: string
          created_at: string
          date: string
          full_pages: number
          id: string
          last_page_entries: number
          logged_at: string
          logged_by: string
        }
        Insert: {
          branch_id?: string
          checkpoint_type?: string
          created_at?: string
          date: string
          full_pages?: number
          id?: string
          last_page_entries?: number
          logged_at?: string
          logged_by: string
        }
        Update: {
          branch_id?: string
          checkpoint_type?: string
          created_at?: string
          date?: string
          full_pages?: number
          id?: string
          last_page_entries?: number
          logged_at?: string
          logged_by?: string
        }
        Relationships: []
      }
      shift_summaries: {
        Row: {
          branch_id: string
          date: string
          first_activity_at: string | null
          holds_flagged: number
          id: string
          off_standard_breakdown: Json | null
          off_standard_minutes: number
          pump2_drift: string | null
          saved_at: string
          trip_count: number
          trip_minutes: number
          user_id: string
          user_name: string
        }
        Insert: {
          branch_id: string
          date: string
          first_activity_at?: string | null
          holds_flagged?: number
          id?: string
          off_standard_breakdown?: Json | null
          off_standard_minutes?: number
          pump2_drift?: string | null
          saved_at?: string
          trip_count?: number
          trip_minutes?: number
          user_id: string
          user_name: string
        }
        Update: {
          branch_id?: string
          date?: string
          first_activity_at?: string | null
          holds_flagged?: number
          id?: string
          off_standard_breakdown?: Json | null
          off_standard_minutes?: number
          pump2_drift?: string | null
          saved_at?: string
          trip_count?: number
          trip_minutes?: number
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          attendance: string | null
          branch_id: string | null
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_stat: boolean
          notes: string | null
          pto_alternate_date: string | null
          pto_approved: boolean
          shift_type: string
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          attendance?: string | null
          branch_id?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_stat?: boolean
          notes?: string | null
          pto_alternate_date?: string | null
          pto_approved?: boolean
          shift_type: string
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          attendance?: string | null
          branch_id?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_stat?: boolean
          notes?: string | null
          pto_alternate_date?: string | null
          pto_approved?: boolean
          shift_type?: string
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unknown_class_codes: {
        Row: {
          code: string
          id: string
          plate: string | null
          seen_at: string
        }
        Insert: {
          code: string
          id?: string
          plate?: string | null
          seen_at?: string
        }
        Update: {
          code?: string
          id?: string
          plate?: string | null
          seen_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          avatar: string | null
          prefs: Json | null
          sidebar: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar?: string | null
          prefs?: Json | null
          sidebar?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar?: string | null
          prefs?: Json | null
          sidebar?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pto: {
        Row: {
          pto_entitlement: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          pto_entitlement?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          pto_entitlement?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicle_checkins: {
        Row: {
          branch_id: string
          checked_in_at: string
          checked_in_by_id: string
          checked_in_by_name: string
          condition_notes: string | null
          ev_adapter_status: string | null
          ev_cable_status: string | null
          exterior_condition: string
          fuel_level: number | null
          id: string
          interior_condition: string
          mileage: number | null
          notes: string | null
          photo_count: number
          routing: string
          vehicle_id: string | null
          vehicle_plate: string
          vehicle_unit: string
        }
        Insert: {
          branch_id: string
          checked_in_at?: string
          checked_in_by_id: string
          checked_in_by_name: string
          condition_notes?: string | null
          ev_adapter_status?: string | null
          ev_cable_status?: string | null
          exterior_condition: string
          fuel_level?: number | null
          id?: string
          interior_condition: string
          mileage?: number | null
          notes?: string | null
          photo_count?: number
          routing: string
          vehicle_id?: string | null
          vehicle_plate: string
          vehicle_unit: string
        }
        Update: {
          branch_id?: string
          checked_in_at?: string
          checked_in_by_id?: string
          checked_in_by_name?: string
          condition_notes?: string | null
          ev_adapter_status?: string | null
          ev_cable_status?: string | null
          exterior_condition?: string
          fuel_level?: number | null
          id?: string
          interior_condition?: string
          mileage?: number | null
          notes?: string | null
          photo_count?: number
          routing?: string
          vehicle_id?: string | null
          vehicle_plate?: string
          vehicle_unit?: string
        }
        Relationships: []
      }
      vehicle_class_codex: {
        Row: {
          code: string
          make: string
          model: string
          taught_at: string
          taught_by: string | null
          updated_at: string
        }
        Insert: {
          code: string
          make: string
          model: string
          taught_at?: string
          taught_by?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          make?: string
          model?: string
          taught_at?: string
          taught_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_identifiers: {
        Row: {
          confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          id: string
          plate: string
          unit_number: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          id?: string
          plate: string
          unit_number: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          id?: string
          plate?: string
          unit_number?: string
        }
        Relationships: []
      }
      vehicle_registry: {
        Row: {
          arrived_at: string | null
          branch_id: string
          cleaned_at: string | null
          color: string | null
          created_at: string
          date: string
          dispatched_at: string | null
          id: string
          make: string | null
          model: string | null
          needs_review: boolean
          plate: string | null
          unit_number: string | null
          vehicle_id: string | null
          year: number | null
        }
        Insert: {
          arrived_at?: string | null
          branch_id: string
          cleaned_at?: string | null
          color?: string | null
          created_at?: string
          date?: string
          dispatched_at?: string | null
          id?: string
          make?: string | null
          model?: string | null
          needs_review?: boolean
          plate?: string | null
          unit_number?: string | null
          vehicle_id?: string | null
          year?: number | null
        }
        Update: {
          arrived_at?: string | null
          branch_id?: string
          cleaned_at?: string | null
          color?: string | null
          created_at?: string
          date?: string
          dispatched_at?: string | null
          id?: string
          make?: string | null
          model?: string | null
          needs_review?: boolean
          plate?: string | null
          unit_number?: string | null
          vehicle_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_registry_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          archived_at: string | null
          archived_by_id: string | null
          branch_id: string | null
          color: string
          cover_photo_url: string | null
          created_at: string | null
          edit_reviewed_at: string | null
          edit_reviewed_by: string | null
          edit_status: string | null
          edit_suggested_at: string | null
          edit_suggested_by: string | null
          edit_suggested_plate: string | null
          edit_suggested_unit: string | null
          edit_suggestion_note: string | null
          ev_last_updated_at: string | null
          ev_last_updated_by: string | null
          field_sources: Json
          has_j1772_adapter: boolean | null
          has_mobile_cable: boolean | null
          id: string
          is_tesla: boolean
          key_count: number | null
          keytag_photo_url: string | null
          license_plate: string
          make: string
          model: string
          rental_class: string | null
          status: string
          unit_number: string | null
          year: number
        }
        Insert: {
          archived_at?: string | null
          archived_by_id?: string | null
          branch_id?: string | null
          color: string
          cover_photo_url?: string | null
          created_at?: string | null
          edit_reviewed_at?: string | null
          edit_reviewed_by?: string | null
          edit_status?: string | null
          edit_suggested_at?: string | null
          edit_suggested_by?: string | null
          edit_suggested_plate?: string | null
          edit_suggested_unit?: string | null
          edit_suggestion_note?: string | null
          ev_last_updated_at?: string | null
          ev_last_updated_by?: string | null
          field_sources?: Json
          has_j1772_adapter?: boolean | null
          has_mobile_cable?: boolean | null
          id: string
          is_tesla?: boolean
          key_count?: number | null
          keytag_photo_url?: string | null
          license_plate: string
          make: string
          model: string
          rental_class?: string | null
          status: string
          unit_number?: string | null
          year: number
        }
        Update: {
          archived_at?: string | null
          archived_by_id?: string | null
          branch_id?: string | null
          color?: string
          cover_photo_url?: string | null
          created_at?: string | null
          edit_reviewed_at?: string | null
          edit_reviewed_by?: string | null
          edit_status?: string | null
          edit_suggested_at?: string | null
          edit_suggested_by?: string | null
          edit_suggested_plate?: string | null
          edit_suggested_unit?: string | null
          edit_suggestion_note?: string | null
          ev_last_updated_at?: string | null
          ev_last_updated_by?: string | null
          field_sources?: Json
          has_j1772_adapter?: boolean | null
          has_mobile_cable?: boolean | null
          id?: string
          is_tesla?: boolean
          key_count?: number | null
          keytag_photo_url?: string | null
          license_plate?: string
          make?: string
          model?: string
          rental_class?: string | null
          status?: string
          unit_number?: string | null
          year?: number
        }
        Relationships: []
      }
      vsa_trips: {
        Row: {
          arrive_location: string | null
          arrive_time: string | null
          auth_type: string | null
          branch_id: string | null
          condition: string | null
          created_at: string | null
          depart_location: string
          depart_time: string
          driver_id: string
          ev_adapter_status: string | null
          ev_cable_status: string | null
          fuel_on_arrival: string | null
          id: string
          is_shuttle: boolean | null
          is_vsa_interruption: boolean | null
          notes: string | null
          one_way: boolean
          queue_at_arrival: string | null
          queue_at_departure: string | null
          reason: string | null
          status: string
          trip_type: string
          vehicle_plate: string | null
          vehicle_unit: string | null
        }
        Insert: {
          arrive_location?: string | null
          arrive_time?: string | null
          auth_type?: string | null
          branch_id?: string | null
          condition?: string | null
          created_at?: string | null
          depart_location: string
          depart_time: string
          driver_id: string
          ev_adapter_status?: string | null
          ev_cable_status?: string | null
          fuel_on_arrival?: string | null
          id: string
          is_shuttle?: boolean | null
          is_vsa_interruption?: boolean | null
          notes?: string | null
          one_way?: boolean
          queue_at_arrival?: string | null
          queue_at_departure?: string | null
          reason?: string | null
          status?: string
          trip_type: string
          vehicle_plate?: string | null
          vehicle_unit?: string | null
        }
        Update: {
          arrive_location?: string | null
          arrive_time?: string | null
          auth_type?: string | null
          branch_id?: string | null
          condition?: string | null
          created_at?: string | null
          depart_location?: string
          depart_time?: string
          driver_id?: string
          ev_adapter_status?: string | null
          ev_cable_status?: string | null
          fuel_on_arrival?: string | null
          id?: string
          is_shuttle?: boolean | null
          is_vsa_interruption?: boolean | null
          notes?: string | null
          one_way?: boolean
          queue_at_arrival?: string | null
          queue_at_departure?: string | null
          reason?: string | null
          status?: string
          trip_type?: string
          vehicle_plate?: string | null
          vehicle_unit?: string | null
        }
        Relationships: []
      }
      washbay_backfill_logs: {
        Row: {
          branch_id: string
          carry_over: number
          cars_remaining: number
          clean_not_picked_up: number
          date: string
          entered_at: string
          entered_by: string
          full_pages: number
          id: string
          last_page_entries: number
          overtime_hours: number
          team_size: number
        }
        Insert: {
          branch_id: string
          carry_over?: number
          cars_remaining?: number
          clean_not_picked_up?: number
          date: string
          entered_at?: string
          entered_by: string
          full_pages?: number
          id?: string
          last_page_entries?: number
          overtime_hours?: number
          team_size?: number
        }
        Update: {
          branch_id?: string
          carry_over?: number
          cars_remaining?: number
          clean_not_picked_up?: number
          date?: string
          entered_at?: string
          entered_by?: string
          full_pages?: number
          id?: string
          last_page_entries?: number
          overtime_hours?: number
          team_size?: number
        }
        Relationships: []
      }
      washbay_logs: {
        Row: {
          airport_flipping: boolean
          branch_id: string
          carry_over: number
          cars_remaining: number
          clean_not_picked_up: number
          date: string
          deferred_completions: number
          full_pages: number
          id: string
          last_page_entries: number
          logged_at: string
          logged_by: string
          lot_status: string
          non_rentables_fuelled: number
          non_rentables_note: string | null
          overtime_hours: number
          shift_hours: number
          team_size: number
        }
        Insert: {
          airport_flipping?: boolean
          branch_id: string
          carry_over?: number
          cars_remaining?: number
          clean_not_picked_up?: number
          date: string
          deferred_completions?: number
          full_pages?: number
          id?: string
          last_page_entries?: number
          logged_at?: string
          logged_by: string
          lot_status?: string
          non_rentables_fuelled?: number
          non_rentables_note?: string | null
          overtime_hours?: number
          shift_hours?: number
          team_size: number
        }
        Update: {
          airport_flipping?: boolean
          branch_id?: string
          carry_over?: number
          cars_remaining?: number
          clean_not_picked_up?: number
          date?: string
          deferred_completions?: number
          full_pages?: number
          id?: string
          last_page_entries?: number
          logged_at?: string
          logged_by?: string
          lot_status?: string
          non_rentables_fuelled?: number
          non_rentables_note?: string | null
          overtime_hours?: number
          shift_hours?: number
          team_size?: number
        }
        Relationships: []
      }
      whiteboard_notes: {
        Row: {
          active_months: number[] | null
          archived_at: string | null
          archived_by_id: string | null
          author_id: string
          author_name: string
          author_role: string
          body: string
          branch_id: string
          created_at: string
          id: string
          section: string
          status: string
          trigger_type: string
        }
        Insert: {
          active_months?: number[] | null
          archived_at?: string | null
          archived_by_id?: string | null
          author_id: string
          author_name?: string
          author_role?: string
          body: string
          branch_id: string
          created_at?: string
          id?: string
          section: string
          status?: string
          trigger_type?: string
        }
        Update: {
          active_months?: number[] | null
          archived_at?: string | null
          archived_by_id?: string | null
          author_id?: string
          author_name?: string
          author_role?: string
          body?: string
          branch_id?: string
          created_at?: string
          id?: string
          section?: string
          status?: string
          trigger_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_branch_id: { Args: never; Returns: string }
      is_manager: { Args: never; Returns: boolean }
      mark_notification_read: {
        Args: { p_notification_id: string; p_user_id: string }
        Returns: undefined
      }
      promote_roster_staff: {
        Args: { p_employee_id: string; p_roster_id: string }
        Returns: {
          branch_id: string
          created_at: string
          employee_id: string
          id: string
          name: string
          quick_start_order: string[] | null
          role: string
          roster_only: boolean
          utility: boolean
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
    Enums: {},
  },
} as const
