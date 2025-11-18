import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, Image as ImageIcon, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTime } from "luxon";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AIRecommendations } from "./AIRecommendations";
import { calculateTaskDuration, formatDuration } from "@/utils/taskDuration";
import { localToUtcISO, formatUtcForDisplay } from "@/utils/timezone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string | null;
    total_time_minutes: number | null;
    status: string;
    image_path: string | null;
    consecutive_missed_days: number;
  };
  statusInfo: {
    bgClass: string;
    textClass: string;
    badgeVariant: "default" | "destructive" | "secondary" | "outline";
    label: string;
  };
  funnyMessage: string | null;
  onRefresh: () => void;
  userTimezone: string;
}

export function TaskCard({ task, statusInfo, funnyMessage, onRefresh, userTimezone }: TaskCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionTime, setCompletionTime] = useState(
    DateTime.now().setZone(userTimezone).toFormat("yyyy-MM-dd'T'HH:mm")
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [completionImage, setCompletionImage] = useState<File | null>(null);

  // Display start time in user's timezone
  const displayStartTime = formatUtcForDisplay(task.start_time, userTimezone, 'time');

  const handleComplete = async () => {
    try {
      // Convert completion time to UTC
      const utcCompletionTime = localToUtcISO(completionTime, userTimezone);
      
      // Calculate duration in user's local timezone
      const durationMinutes = calculateTaskDuration(
        task.start_time,
        utcCompletionTime,
        userTimezone
      );

      let imagePath = task.image_path;

      // Upload completion image if provided
      if (completionImage) {
        setUploadingImage(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = completionImage.name.split(".").pop();
        const fileName = `${user.id}/${task.id}-completion-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(fileName, completionImage);

        if (uploadError) throw uploadError;
        imagePath = fileName;
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          end_time: utcCompletionTime,
          total_time_minutes: durationMinutes,
          image_path: imagePath,
        })
        .eq("id", task.id);

      if (error) throw error;

      toast({
        title: "Task completed! 🎉",
        description: `Great job! You took ${formatDuration(durationMinutes)}.`,
      });

      setShowCompleteDialog(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <>
      <Card
        className={`p-4 smooth ${statusInfo.bgClass} border cursor-pointer hover:scale-[1.02]`}
        onClick={() => navigate(`/tasks/${task.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className={`font-semibold text-base mb-1 ${statusInfo.textClass}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          <Badge variant={statusInfo.badgeVariant} className="ml-2 shrink-0">
            {statusInfo.label}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{displayStartTime}</span>
          </div>
          {task.total_time_minutes && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>{formatDuration(task.total_time_minutes)}</span>
            </div>
          )}
          {task.image_path && (
            <div className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              <span>Photo</span>
            </div>
          )}
        </div>

        {funnyMessage && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3">
            <p className="text-sm text-destructive-foreground font-medium">
              {funnyMessage}
            </p>
          </div>
        )}

        {task.status === "pending" && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setShowCompleteDialog(true);
            }}
            className="w-full"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        )}

        <AIRecommendations task={task} />
      </Card>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="completion-time">Completion Time</Label>
              <Input
                id="completion-time"
                type="datetime-local"
                value={completionTime}
                onChange={(e) => setCompletionTime(e.target.value)}
                max={DateTime.now().setZone(userTimezone).toFormat("yyyy-MM-dd'T'HH:mm")}
              />
            </div>
            <div>
              <Label htmlFor="completion-image">Completion Photo (Optional)</Label>
              <Input
                id="completion-image"
                type="file"
                accept="image/*"
                onChange={(e) => setCompletionImage(e.target.files?.[0] || null)}
              />
            </div>
            <Button
              onClick={handleComplete}
              disabled={uploadingImage}
              className="w-full"
            >
              {uploadingImage ? "Uploading..." : "Complete Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
