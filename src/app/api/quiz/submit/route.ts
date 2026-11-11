import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, answers } = body;

    if (!sessionId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "sessionId and answers are required" }, { status: 400 });
    }

    // Verify quiz session exists and belongs to user
    const quizSession = await prisma.quizSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    });

    if (!quizSession) {
      return NextResponse.json({ error: "Quiz session not found" }, { status: 404 });
    }

    if (quizSession.completedAt !== null) {
      return NextResponse.json(
        { error: "Quiz session already completed" },
        { status: 400 },
      );
    }

    // Fetch cards referenced in answers to perform genuine server-side grading
    const cardIds = answers
      .map((a: { cardId?: string }) => a.cardId)
      .filter((id): id is string => typeof id === "string" && Boolean(id));

    const cards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
    });
    const cardMap = new Map(cards.map((c) => [c.id, c]));

    // Grade answers server-side against database records
    let correctCount = 0;
    let wrongCount = 0;

    const isMeaningOrFill =
      quizSession.quizType === "meaning_match" || quizSession.quizType === "fill_blank";

    const answerData = answers.map((a: {
      cardId: string;
      selectedAnswer?: string;
      userAnswer?: string;
      timeSpentMs?: number;
    }) => {
      const card = cardMap.get(a.cardId);
      const submittedAnswer = ((a.selectedAnswer ?? a.userAnswer ?? "") as string).trim();
      const expectedAnswer = card ? (isMeaningOrFill ? card.front : card.back) : "";

      const isCorrect = Boolean(
        card &&
        submittedAnswer &&
        submittedAnswer.toLowerCase() === expectedAnswer.trim().toLowerCase()
      );

      if (isCorrect) correctCount++;
      else wrongCount++;

      return {
        quizSessionId: sessionId,
        cardId: a.cardId,
        userAnswer: submittedAnswer,
        correctAnswer: expectedAnswer,
        isCorrect,
        timeSpentMs: a.timeSpentMs || 0,
      };
    });

    const score = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

    await prisma.$transaction([
      prisma.quizAnswer.createMany({ data: answerData }),
      prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          correctCount,
          wrongCount,
          score,
          completedAt: new Date(),
        },
      }),
    ]);

    let gamificationResult = null;
    try {
      const { addQuizActivity } = await import("@/lib/gamification");
      gamificationResult = await addQuizActivity(session.user.id, correctCount, answers.length);
    } catch (err) {
      console.error("Gamification error:", err);
    }

    return NextResponse.json({
      score,
      correctCount,
      wrongCount,
      totalQuestions: answers.length,
      gamification: gamificationResult,
    });
  } catch (error) {
    console.error("Quiz submit error:", error);
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 });
  }
}
