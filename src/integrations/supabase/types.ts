export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          name: string
          type: string
          color: string
          closing_day: number | null
          due_day: number | null
          active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          color?: string
          closing_day?: number | null
          due_day?: number | null
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          color?: string
          closing_day?: number | null
          due_day?: number | null
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          icon: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          id: string
          type: string
          description: string
          amount: number
          category_id: string | null
          account_id: string | null
          active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          description: string
          amount: number
          category_id?: string | null
          account_id?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          description?: string
          amount?: number
          category_id?: string | null
          account_id?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "templates_category_id_fkey"; columns: ["category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] },
          { foreignKeyName: "templates_account_id_fkey"; columns: ["account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      fixed_expenses: {
        Row: {
          id: string
          template_id: string | null
          month: string
          description: string
          estimated_amount: number
          actual_amount: number | null
          category_id: string | null
          account_id: string | null
          due_date: string | null
          status: string
          paid_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          month: string
          description: string
          estimated_amount: number
          actual_amount?: number | null
          category_id?: string | null
          account_id?: string | null
          due_date?: string | null
          status?: string
          paid_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string | null
          month?: string
          description?: string
          estimated_amount?: number
          actual_amount?: number | null
          category_id?: string | null
          account_id?: string | null
          due_date?: string | null
          status?: string
          paid_date?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "fixed_expenses_template_id_fkey"; columns: ["template_id"]; referencedRelation: "templates"; referencedColumns: ["id"] },
          { foreignKeyName: "fixed_expenses_category_id_fkey"; columns: ["category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] },
          { foreignKeyName: "fixed_expenses_account_id_fkey"; columns: ["account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      income_entries: {
        Row: {
          id: string
          template_id: string | null
          month: string
          description: string
          estimated_amount: number
          actual_amount: number | null
          account_id: string | null
          status: string
          received_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          month: string
          description: string
          estimated_amount: number
          actual_amount?: number | null
          account_id?: string | null
          status?: string
          received_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string | null
          month?: string
          description?: string
          estimated_amount?: number
          actual_amount?: number | null
          account_id?: string | null
          status?: string
          received_date?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "income_entries_template_id_fkey"; columns: ["template_id"]; referencedRelation: "templates"; referencedColumns: ["id"] },
          { foreignKeyName: "income_entries_account_id_fkey"; columns: ["account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      monthly_budgets: {
        Row: {
          id: string
          template_id: string | null
          month: string
          category_id: string
          description: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          month: string
          category_id: string
          description: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string | null
          month?: string
          category_id?: string
          description?: string
          amount?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "monthly_budgets_template_id_fkey"; columns: ["template_id"]; referencedRelation: "templates"; referencedColumns: ["id"] },
          { foreignKeyName: "monthly_budgets_category_id_fkey"; columns: ["category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] }
        ]
      }
      expense_entries: {
        Row: {
          id: string
          template_id: string | null
          description: string
          amount: number
          category_id: string
          account_id: string
          date: string
          status: string
          paid_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          description: string
          amount: number
          category_id: string
          account_id: string
          date: string
          status?: string
          paid_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string | null
          description?: string
          amount?: number
          category_id?: string
          account_id?: string
          date?: string
          status?: string
          paid_date?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "expense_entries_template_id_fkey"; columns: ["template_id"]; referencedRelation: "templates"; referencedColumns: ["id"] },
          { foreignKeyName: "expense_entries_category_id_fkey"; columns: ["category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] },
          { foreignKeyName: "expense_entries_account_id_fkey"; columns: ["account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      credit_card_bills: {
        Row: {
          id: string
          account_id: string
          month: string
          status: string
          paid_amount: number | null
          previous_balance: number
          paid_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          month: string
          status?: string
          paid_amount?: number | null
          previous_balance?: number
          paid_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          month?: string
          status?: string
          paid_amount?: number | null
          previous_balance?: number
          paid_date?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "credit_card_bills_account_id_fkey"; columns: ["account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      transfers: {
        Row: {
          id: string
          from_account_id: string
          to_account_id: string
          amount: number
          date: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          from_account_id: string
          to_account_id: string
          amount: number
          date: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          from_account_id?: string
          to_account_id?: string
          amount?: number
          date?: string
          description?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "transfers_from_account_id_fkey"; columns: ["from_account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] },
          { foreignKeyName: "transfers_to_account_id_fkey"; columns: ["to_account_id"]; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      app_settings: {
        Row: {
          id: number
          initial_balance: number
          updated_at: string
        }
        Insert: {
          id?: number
          initial_balance?: number
          updated_at?: string
        }
        Update: {
          id?: number
          initial_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
