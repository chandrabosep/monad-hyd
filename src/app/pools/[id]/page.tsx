import { redirect } from "next/navigation";

/**
 * /pools/[id] redirects to /bet/[id] for compatibility with X reply links.
 */
export default async function PoolsRedirect({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/bet/${id}`);
}
