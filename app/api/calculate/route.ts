import { NextRequest, NextResponse } from 'next/server';
import { CalculateRequestSchema } from '@/lib/schema';
import { analyzeImage } from '@/lib/utils';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = CalculateRequestSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error },
        { status: 400 }
      );
    }

    // Process the calculation
    const imageBlob = await fetch(validatedData.data.image).then(res => res.blob());
    const result = await analyzeImage(imageBlob, validatedData.data.dict_of_vars);

    return NextResponse.json({ data: result }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error: unknown) {
    console.error('Calculate API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}