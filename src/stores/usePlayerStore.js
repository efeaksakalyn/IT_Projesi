import { create } from 'zustand';

const usePlayerStore = create((set, get) => ({
    isPlaying: false,
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    queueIndex: -1,
    volume: 0.8,
    refreshTrigger: 0,

    playTrack: (track, newQueue = []) => {
        const state = get();
        // If a new queue is provided, replace it. 
        // If just playing a track from no context (or same context), logic varies.
        // Simplified: Always set queue if provided. If not, make a queue of 1.
        let queue = newQueue.length > 0 ? newQueue : [track];
        let index = queue.findIndex(t => t.id === track.id);
        if (index === -1) index = 0;

        set({
            currentTrack: track,
            isPlaying: true,
            queue: queue,
            queueIndex: index
        });
    },

    playNext: () => {
        const { queue, queueIndex } = get();
        if (queueIndex < queue.length - 1) {
            const nextTrack = queue[queueIndex + 1];
            set({ currentTrack: nextTrack, queueIndex: queueIndex + 1, isPlaying: true });
        }
    },

    playPrev: () => {
        const { queue, queueIndex } = get();
        if (queueIndex > 0) {
            const prevTrack = queue[queueIndex - 1];
            set({ currentTrack: prevTrack, queueIndex: queueIndex - 1, isPlaying: true });
        }
    },

    pause: () => set({ isPlaying: false }),
    resume: () => set({ isPlaying: true }),
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setVolume: (vol) => set({ volume: vol }),
    triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));

export default usePlayerStore;
