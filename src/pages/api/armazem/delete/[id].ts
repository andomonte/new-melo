import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Ensure this endpoint only responds to DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed. Use DELETE.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial not provided in cookie.' });
  }

  let client: PoolClient | undefined;
  // Get the 'id' from the URL query parameters
  const { id } = req.query;

  // Validate that 'id' is present and a string
  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'Warehouse ID is required and must be a string.' });
  }

  // Attempt to parse the ID to an integer for database operations.
  // It's safer to work with numbers if the database ID is an integer.
  const armazemId = parseInt(id, 10);
  if (isNaN(armazemId)) {
    return res.status(400).json({ error: 'Invalid warehouse ID provided.' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN'); // Start transaction for atomicity

    // Check if the warehouse exists and belongs to the specified filial
    // This step is crucial to prevent deleting non-existent warehouses or those
    // belonging to other filials, and to provide a more specific error message.
    const checkResult = await client.query(
      'SELECT id_armazem FROM dbarmazem WHERE id_armazem = $1 AND filial = $2',
      [armazemId, filial], // Use the parsed integer ID
    );

    if (checkResult.rowCount === 0) {
      // If no row found, it means the warehouse doesn't exist or doesn't belong to this filial
      throw new Error(
        `Warehouse with ID ${armazemId} not found for filial ${filial}.`,
      );
    }

    // Proceed with deletion
    const deleteResult = await client.query(
      'DELETE FROM dbarmazem WHERE id_armazem = $1 AND filial = $2',
      [armazemId, filial], // Use the parsed integer ID
    );

    // Optional: You could also check deleteResult.rowCount here to confirm deletion,
    // although the prior checkResult already confirms existence.
    if (deleteResult.rowCount === 0) {
      // This case should ideally not happen if checkResult.rowCount > 0,
      // but it's a fail-safe for very rare race conditions.
      throw new Error(`Failed to delete warehouse with ID ${armazemId}.`);
    }

    await client.query('COMMIT'); // Commit the transaction

    res
      .status(200)
      .json({
        message: `Warehouse with ID ${armazemId} deleted successfully.`,
      });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK'); // Rollback on error
    }
    console.error('Error deleting warehouse:', error);
    // Provide a generic error message to the client for security, log the detailed error internally
    res
      .status(500)
      .json({ error: error.message || 'Error deleting warehouse.' });
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
}
