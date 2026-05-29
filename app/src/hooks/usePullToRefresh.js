import { useCallback, useRef, useState } from 'react';

const PULL_THRESHOLD = 80;

export default function usePullToRefresh(refreshing, onRefresh) {
    const [pullDistance, setPullDistance] = useState(0);
    const lastPullRef = useRef(0);

    const handleScroll = useCallback(e => {
        const offsetY = e.nativeEvent.contentOffset.y;
        lastPullRef.current = Math.max(0, -offsetY);
        setPullDistance(lastPullRef.current);
    }, []);

    const handleScrollEndDrag = useCallback(() => {
        if (lastPullRef.current >= PULL_THRESHOLD && !refreshing) {
            onRefresh();
        }
    }, [refreshing, onRefresh]);

    return { pullDistance, handleScroll, handleScrollEndDrag };
}
