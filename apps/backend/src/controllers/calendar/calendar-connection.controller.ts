import { Request, Response } from "express";

import {
  AesGcmCredentialVault,
  CalendarConnectionManager,
  CalendarConnectionNotFoundError,
  PrismaUserCalendarConnectionRepository,
} from "../../services/calendar/connections";
import { CalendarProviderRegistry } from "../../services/calendar/providers";
import {
  calendarConnectionIdParamSchema,
  updateCalendarConnectionBodySchema,
} from "../../validators/calendar-connection.validator";

const defaultVault = new AesGcmCredentialVault();
const defaultRepository = new PrismaUserCalendarConnectionRepository();
const defaultRegistry = new CalendarProviderRegistry();

let connectionManager = new CalendarConnectionManager(
  defaultRepository,
  defaultVault,
  defaultRegistry,
);
let providerRegistry = defaultRegistry;

export function setCalendarConnectionManager(
  manager: CalendarConnectionManager,
): void {
  connectionManager = manager;
}

export function setCalendarProviderRegistry(
  registry: CalendarProviderRegistry,
): void {
  providerRegistry = registry;
}

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  });
}

/**
 * GET /api/v1/calendar/connections
 * Lists all sanitized calendar connections for the authenticated user.
 */
export async function listCalendarConnections(
  req: Request,
  res: Response,
): Promise<Response> {
  if (!req.user) {
    return unauthorized(res);
  }

  try {
    const connections = await connectionManager.listConnections(req.user.id);
    return res.status(200).json({
      success: true,
      data: connections,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * GET /api/v1/calendar/connections/:id
 * Retrieves metadata for an owned calendar connection. Fails closed with 404 on cross-user access.
 */
export async function getCalendarConnectionById(
  req: Request,
  res: Response,
): Promise<Response> {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedParams = calendarConnectionIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedParams.error.issues[0]?.message ??
          "Invalid calendar connection ID.",
      },
    });
  }

  try {
    const connection = await connectionManager.getConnection(
      req.user.id,
      parsedParams.data.id,
    );

    return res.status(200).json({
      success: true,
      data: connection,
    });
  } catch (error) {
    if (error instanceof CalendarConnectionNotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

/**
 * PATCH /api/v1/calendar/connections/:id
 * Updates connection metadata (displayName, accountEmail, metadata, status).
 */
export async function updateCalendarConnection(
  req: Request,
  res: Response,
): Promise<Response> {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedParams = calendarConnectionIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedParams.error.issues[0]?.message ??
          "Invalid calendar connection ID.",
      },
    });
  }

  const parsedBody = updateCalendarConnectionBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedBody.error.issues[0]?.message ??
          "Invalid calendar connection update payload.",
      },
    });
  }

  try {
    const connectionId = parsedParams.data.id;
    let updated = await connectionManager.getConnection(
      req.user.id,
      connectionId,
    );

    if (
      parsedBody.data.displayName !== undefined ||
      parsedBody.data.accountEmail !== undefined ||
      parsedBody.data.metadata !== undefined
    ) {
      updated = await connectionManager.updateConnection(
        req.user.id,
        connectionId,
        {
          displayName: parsedBody.data.displayName,
          accountEmail: parsedBody.data.accountEmail,
          metadata: parsedBody.data.metadata,
        },
      );
    }

    if (parsedBody.data.status) {
      updated = await connectionManager.updateConnectionStatus(
        req.user.id,
        connectionId,
        parsedBody.data.status,
      );
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof CalendarConnectionNotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

/**
 * DELETE /api/v1/calendar/connections/:id
 * Permanently removes a calendar connection for the authenticated user.
 */
export async function deleteCalendarConnection(
  req: Request,
  res: Response,
): Promise<Response> {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedParams = calendarConnectionIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedParams.error.issues[0]?.message ??
          "Invalid calendar connection ID.",
      },
    });
  }

  try {
    await connectionManager.deleteConnection(
      req.user.id,
      parsedParams.data.id,
    );

    return res.status(200).json({
      success: true,
      message: "Calendar connection deleted successfully.",
    });
  } catch (error) {
    if (error instanceof CalendarConnectionNotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

/**
 * GET /api/v1/calendar/providers
 * Lists registered calendar providers and their declared capabilities.
 */
export async function listCalendarProviders(
  req: Request,
  res: Response,
): Promise<Response> {
  if (!req.user) {
    return unauthorized(res);
  }

  const providers = providerRegistry.list().map((provider) => ({
    id: provider.id,
    name: provider.name,
    capabilities: provider.capabilities,
  }));

  return res.status(200).json({
    success: true,
    data: providers,
  });
}
