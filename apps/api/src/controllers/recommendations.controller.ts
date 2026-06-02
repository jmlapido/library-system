import type { Context } from 'hono';
import { getRecommendations } from '../services/recommendations.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

/**
 * GET /api/v1/recommendations
 * Returns AI-powered personalized book recommendations for the authenticated user.
 * Returns an empty array with an explanatory message when the AI is not configured.
 */
export async function getRecommendationsController(c: Context) {
  const user = c.get('user') as AccessTokenPayload;

  try {
    const recommendations = await getRecommendations(user.sub, user.schoolId!);

    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json(
        {
          success: true,
          data: [],
          message: 'AI recommendations not configured',
        },
        200,
      );
    }

    return c.json(
      {
        success: true,
        data: recommendations,
        message: recommendations.length > 0
          ? 'Recommendations retrieved successfully'
          : 'No recommendations available at this time',
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error({ name: 'RecommendationsError', message });
    return c.json(
      { success: false, error: 'Failed to retrieve recommendations', code: 'INTERNAL_ERROR' },
      500,
    );
  }
}
