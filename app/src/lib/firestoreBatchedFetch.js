import { getDocs } from 'firebase/firestore';

export const DEFAULT_BATCH_SIZE = 100;
export const SLOW_QUERY_THRESHOLD_MS = 5000;

export async function fetchPagedDocuments({
    buildQuery,
    onPage,
    pageSize = DEFAULT_BATCH_SIZE,
    slowThresholdMs = SLOW_QUERY_THRESHOLD_MS,
}) {
    const startedAt = Date.now();
    let lastDoc = null;
    let pageCount = 0;
    let totalDocs = 0;

    while (true) {
        const snapshot = await getDocs(buildQuery({ lastDoc, pageSize }));
        pageCount += 1;

        if (snapshot.empty) {
            break;
        }

        totalDocs += snapshot.size;

        if (typeof onPage === 'function') {
            await onPage(snapshot.docs, {
                pageCount,
                totalDocs,
                lastDoc: snapshot.docs[snapshot.docs.length - 1],
            });
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        if (snapshot.size < pageSize) {
            break;
        }
    }

    const durationMs = Date.now() - startedAt;

    return {
        totalDocs,
        pageCount,
        durationMs,
        isSlow: durationMs > slowThresholdMs,
    };
}
