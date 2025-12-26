export interface MockInterviewReadModel {
  id: string;
  sessionType: string;
  studentUserId: string;
  studentName: { en: string; zh: string };
  createdByCounselorId: string;
  createdByCounselorName: { en: string; zh: string } | null;
  title: string;
  status: string;
  scheduledAt: Date;
  scheduleDuration: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  deletedAt: Date | null;
  interviewType: string;
  language: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  studentInfo: string;
  interviewQuestions: string[];
  interviewInstructions: string;
  systemInstruction: string;
  serviceType: string;
  aiSummaries: any[];
  createdAt: Date;
  updatedAt: Date;
}
