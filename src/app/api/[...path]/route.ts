import { NextRequest } from 'next/server';
import { handleApiRequest } from '../../../../server/api/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiRouteContext = {
    params: Promise<{
        path: string[];
    }>;
};

const getPath = async (context: ApiRouteContext) => {
    const params = await context.params;
    return params.path ?? [];
};

export const GET = async (request: NextRequest, context: ApiRouteContext) =>
    handleApiRequest(request, await getPath(context));

export const HEAD = async (request: NextRequest, context: ApiRouteContext) =>
    handleApiRequest(request, await getPath(context));

export const POST = async (request: NextRequest, context: ApiRouteContext) =>
    handleApiRequest(request, await getPath(context));

export const PUT = async (request: NextRequest, context: ApiRouteContext) =>
    handleApiRequest(request, await getPath(context));

export const DELETE = async (request: NextRequest, context: ApiRouteContext) =>
    handleApiRequest(request, await getPath(context));
