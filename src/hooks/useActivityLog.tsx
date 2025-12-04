import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useActivityLog = () => {
  const { user } = useAuth();

  const logActivity = async (
    actionType: string,
    actionDescription: string,
    tableName?: string,
    recordId?: string
  ) => {
    if (!user) return;

    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action_type: actionType,
        action_description: actionDescription,
        table_name: tableName,
        record_id: recordId,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  return { logActivity };
};
