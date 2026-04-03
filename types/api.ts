export type ApplicationApiResponse =
  | {
      success: true;
      data: {
        applicationId: string;
        candidateId: string;
        emailStatus: "sent" | "failed" | "skipped";
        emailError?: string;
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };
