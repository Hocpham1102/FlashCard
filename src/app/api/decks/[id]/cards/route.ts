import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    const deck = await prisma.deck.findUnique({
      where: { id },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    if (!deck.isPublic) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (deck.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const cards = await prisma.card.findMany({
      where: { deckId: id },
      orderBy: { createdAt: "desc" },
    });
    const result = cards.map((c) => ({ ...c, _id: c.id }));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const deck = await prisma.deck.findUnique({
      where: { id },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    if (deck.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { front, back, phonetic, example, partOfSpeech, synonyms, antonyms, collocations, toeicPart, difficulty } = body;

    if (!front || typeof front !== "string" || !front.trim()) {
      return NextResponse.json({ error: "Front is required" }, { status: 400 });
    }
    if (!back || typeof back !== "string" || !back.trim()) {
      return NextResponse.json({ error: "Back is required" }, { status: 400 });
    }

    const [card] = await prisma.$transaction([
      prisma.card.create({
        data: {
          deckId: id,
          front: front.trim(),
          back: back.trim(),
          phonetic: phonetic || "",
          example: example || "",
          partOfSpeech: partOfSpeech || "",
          synonyms: synonyms || "",
          antonyms: antonyms || "",
          collocations: collocations || "",
          toeicPart: toeicPart || "",
          difficulty: difficulty || "medium",
        },
      }),
      prisma.deck.update({
        where: { id },
        data: { cardCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ ...card, _id: card.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create card" },
      { status: 500 },
    );
  }
}
