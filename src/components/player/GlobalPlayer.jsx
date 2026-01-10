import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2 } from 'lucide-react';
import usePlayerStore from '../../stores/usePlayerStore';
import { supabase } from '../../lib/supabase';

const GlobalPlayer = () => {
    const { currentTrack, isPlaying, togglePlay, volume, setVolume, playNext, playPrev, pause } = usePlayerStore();
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(new Audio());
    const [isDragging, setIsDragging] = useState(false); // To prevent jumpy slider while seeking

    useEffect(() => {
        if (currentTrack) {
            audioRef.current.src = currentTrack.audio_url;
            audioRef.current.load();
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Play failed:", e));
            }
            // Increment plays
            supabase.rpc('increment_plays', { beat_id_input: currentTrack.id })
                .then(({ error }) => { if (error) console.error("RPC Error:", error); });
        }
    }, [currentTrack]);

    useEffect(() => {
        if (isPlaying) {
            audioRef.current.play().catch(e => {
                console.error("Play failed:", e);
            });
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

    useEffect(() => {
        const audio = audioRef.current;

        const updateTime = () => {
            if (!isDragging) setCurrentTime(audio.currentTime);
        };
        const updateDuration = () => setDuration(audio.duration);
        const onEnded = () => {
            pause();
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', onEnded);
        };
    }, [isDragging]);

    const handleBack = () => {
        // If current time > 3s, reset to 0. Else go prev.
        if (audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
        } else {
            playPrev();
        }
    };

    const handleSeekChange = (e) => {
        setIsDragging(true);
        const newTime = (e.target.value / 100) * duration;
        setCurrentTime(newTime);
    };

    const handleSeekCommit = (e) => {
        const newTime = (e.target.value / 100) * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        setIsDragging(false);
    };

    const handleVolumeChange = (e) => {
        setVolume(parseFloat(e.target.value));
    };

    const formatTime = (time) => {
        if (isNaN(time)) return "00:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!currentTrack) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-black border-t border-white/10 z-50 px-6 flex items-center justify-between">

            {/* Track Info */}
            <div className="flex items-center gap-4 w-1/4">
                <div className="w-12 h-12 bg-neutral-800 rounded overflow-hidden">
                    {currentTrack?.cover_url ? (
                        <img src={currentTrack.cover_url} alt={currentTrack.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
                    )}
                </div>
                <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-white truncate">{currentTrack?.title || 'No Track Selected'}</h4>
                    <p className="text-xs text-neutral-400 truncate">{currentTrack?.producer_name || currentTrack?.producer?.username || 'Select a beat to play'}</p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-2 flex-1 max-w-xl">
                <div className="flex items-center gap-6">
                    <button onClick={handleBack} className="text-neutral-400 hover:text-white transition-colors">
                        <SkipBack size={20} />
                    </button>
                    <button
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors shadow-lg shadow-red-900/40 ${!currentTrack ? 'bg-neutral-800 cursor-not-allowed text-neutral-500' : 'bg-primary hover:bg-red-600'}`}
                        onClick={() => currentTrack && togglePlay()}
                        disabled={!currentTrack}
                    >
                        {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1" />}
                    </button>
                    <button onClick={playNext} className="text-neutral-400 hover:text-white transition-colors">
                        <SkipForward size={20} />
                    </button>
                </div>

                {/* Progress Bar & Time */}
                <div className="w-full flex items-center gap-3 text-xs font-medium text-neutral-400">
                    <span className="w-10 text-right">{formatTime(currentTime)}</span>

                    {/* Native Range Input for better drag feeling if supported, or custom div logic */}
                    {/* User asked for onChange drag-and-drop. Native range is best for this. */}
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={duration ? (currentTime / duration) * 100 : 0}
                        onChange={handleSeekChange}
                        onMouseUp={handleSeekCommit}
                        onTouchEnd={handleSeekCommit}
                        className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100 transition-all custom-range"
                        style={{
                            background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${(currentTime / (duration || 1)) * 100}%, #262626 ${(currentTime / (duration || 1)) * 100}%, #262626 100%)`
                        }}
                    />

                    <span className="w-10">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume & Extras */}
            <div className="flex items-center justify-end gap-4 w-1/4">
                <div className="flex items-center group gap-2">
                    <Volume2 size={20} className="text-neutral-400" />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-24 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:opacity-0 hover:[&::-webkit-slider-thumb]:opacity-100 transition-all"
                        style={{
                            background: `linear-gradient(to right, #737373 0%, #737373 ${volume * 100}%, #262626 ${volume * 100}%, #262626 100%)`
                        }}
                    />
                </div>
            </div>

        </div>
    );
};

export default GlobalPlayer;
