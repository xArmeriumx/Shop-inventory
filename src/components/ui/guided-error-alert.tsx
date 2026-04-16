'use client';

import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ErrorAction } from "@/types/domain";

interface GuidedErrorAlertProps {
  title?: string;
  message: string;
  action?: ErrorAction;
  className?: string;
}

export function GuidedErrorAlert({ 
  title = "เกิดข้อผิดพลาด", 
  message, 
  action,
  className 
}: GuidedErrorAlertProps) {
  if (!message) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div>
          <AlertTitle className="font-bold">{title}</AlertTitle>
          <AlertDescription>
            {message}
          </AlertDescription>
        </div>
        {action && (
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-background hover:bg-muted text-destructive-foreground border-destructive/50 shrink-0" 
            asChild
          >
            <Link href={action.href} className="flex items-center gap-2">
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </Alert>
  );
}
