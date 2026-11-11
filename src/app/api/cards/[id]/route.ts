import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const existingCard = await prisma.card.findUnique({
      where: { id },
      include: { deck: true },
    });

    if (!existingCard) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (existingCard.deck?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { front, back, phonetic, example, partOfSpeech, synonyms, antonyms, collocations, toeicPart, difficulty } = body;

    const updateData: Record<string, string> = {};
    if (front !== undefined) updateData.front = front;
    if (back !== undefined) updateData.back = back;
    if (phonetic !== undefined) updateData.phonetic = phonetic;
    if (example !== undefined) updateData.example = example;
    if (partOfSpeech !== undefined) updateData.partOfSpeech = partOfSpeech;
    if (synonyms !== undefined) updateData.synonyms = synonyms;
    if (antonyms !== undefined) updateData.antonyms = antonyms;
    if (collocations !== undefined) updateData.collocations = collocations;
    if (toeicPart !== undefined) updateData.toeicPart = toeicPart;
    if (difficulty !== undefined) updateData.difficulty = difficulty;

    const card = await prisma.card.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ...card, _id: card.id });
  } catch {
    return NextResponse.json(
      { error: "Failed to update card" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const card = await prisma.card.findUnique({
      where: { id },
      include: { deck: true },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.deck?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.card.delete({ where: { id } }),
      prisma.deck.update({
        where: { id: card.deckId },
        data: { cardCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete card" },
      { status: 500 },
    );
  }
}
