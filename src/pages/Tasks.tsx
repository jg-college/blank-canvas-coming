import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar, Clock, Image as ImageIcon, ClipboardList } from "lucide-react";
import { DateTime } from "luxon";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { getUserTimezone, startOfTodayInZone } from "@/utils/timezone";

interface Task {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  total_time_minutes: number | null;
  status: string;
  image_path: string | null;
  consecutive_missed_days: number;
  task_date: string;
  original_date: string;
}

export default function Tasks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState("UTC");

  useEffect(() => {
    initializeTasks();
  }, []);

  const initializeTasks = async () => {
    await fetchUserTimezone();
    await carryForwardTasks();
    await fetchTasks();
  };

  const fetchUserTimezone = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("user_id", user.id)
        .single();
      
      if (profile?.timezone) {
        setUserTimezone(profile.timezone);
      }
    }
  };

  const carryForwardTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get today in user's timezone
      const todayStart = startOfTodayInZone(userTimezone);
      const today = todayStart.toFormat('yyyy-MM-dd');
      
      // Find all pending tasks with scheduledDate < today
      const { data: pendingTasks, error: fetchError } = await supabase
        .from("tasks")
        .select("id, task_date, consecutive_missed_days, start_time")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lt("task_date", today);

      if (fetchError) throw fetchError;

      // Update each task's scheduledDate to today, keeping the same local time
      if (pendingTasks && pendingTasks.length > 0) {
        const updates = pendingTasks.map((task) => {
          const daysMissed = Math.floor(
            todayStart.diff(DateTime.fromISO(task.task_date, { zone: userTimezone }), 'days').days
          );
          
          // Parse the original start_time UTC, convert to user's timezone to get the time portion
          const originalStartDt = DateTime.fromISO(task.start_time, { zone: 'UTC' }).setZone(userTimezone);
          const timeOfDay = originalStartDt.toFormat('HH:mm:ss');
          
          // Build new start_time: today's date + original time of day in user's timezone, then convert to UTC
          const newStartDt = DateTime.fromFormat(`${today} ${timeOfDay}`, 'yyyy-MM-dd HH:mm:ss', { zone: userTimezone });
          const newStartTimeUtc = newStartDt.toUTC().toISO();
          
          return supabase
            .from("tasks")
            .update({
              task_date: today,
              start_time: newStartTimeUtc,
              consecutive_missed_days: (task.consecutive_missed_days || 0) + daysMissed,
            })
            .eq("id", task.id);
        });

        await Promise.all(updates);
      }
    } catch (error: any) {
      console.error("Carry-forward error:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get today in user's timezone
      const today = startOfTodayInZone(userTimezone).toFormat('yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("task_date", today)
        .order("start_time", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTaskStatusInfo = (task: Task) => {
    if (task.status === "completed") {
      return {
        bgClass: "bg-valid-bg border-valid/30",
        textClass: "text-valid-foreground",
        badgeVariant: "default" as const,
        label: "Completed",
      };
    } else if (task.consecutive_missed_days >= 3) {
      return {
        bgClass: "bg-expired-bg border-expired/30",
        textClass: "text-expired-foreground",
        badgeVariant: "destructive" as const,
        label: `Overdue ${task.consecutive_missed_days} days`,
      };
    } else if (task.consecutive_missed_days > 0) {
      return {
        bgClass: "bg-expiring-bg border-expiring/30",
        textClass: "text-expiring-foreground",
        badgeVariant: "secondary" as const,
        label: `Carried ${task.consecutive_missed_days} day${task.consecutive_missed_days > 1 ? 's' : ''}`,
      };
    }
    return {
      bgClass: "bg-card border-border/80",
      textClass: "text-foreground",
      badgeVariant: "outline" as const,
      label: "Pending",
    };
  };

  const getFunnyMessage = (days: number) => {
    const messages = [
      "Bro… 3 days? Too lazy or too legendary? 😂",
      "Your task is crying… finish it 😭😂",
      "Even your alarm gave up on you! 🤦‍♂️",
      "3 days later... still waiting 😴",
      "This task has trust issues now 💔",
    ];
    return days >= 3 ? messages[Math.floor(Math.random() * messages.length)] : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background p-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Daily Tasks</h1>
          <p className="text-sm text-muted-foreground">Track your daily activities</p>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-[14px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background p-6 sticky top-0 z-10 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Daily Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {DateTime.now().setZone(userTimezone).toFormat("EEEE, MMM d")} • {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={() => navigate("/tasks/history")}
            variant="outline"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="p-4 space-y-4">
        {tasks.length === 0 ? (
          <Card className="p-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No tasks for today</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first task to get started!
            </p>
            <Button onClick={() => navigate("/tasks/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </Card>
        ) : (
          tasks.map((task) => {
            const statusInfo = getTaskStatusInfo(task);
            const funnyMessage = getFunnyMessage(task.consecutive_missed_days);
            
            return (
              <TaskCard
                key={task.id}
                task={task}
                statusInfo={statusInfo}
                funnyMessage={funnyMessage}
                onRefresh={fetchTasks}
                userTimezone={userTimezone}
              />
            );
          })
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        onClick={() => navigate("/tasks/add")}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full shadow-lg btn-glow"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
      <BottomNavigation />
    </div>
  );
}
