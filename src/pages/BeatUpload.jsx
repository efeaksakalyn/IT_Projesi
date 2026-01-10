import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import { Upload, Loader2, DollarSign, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BeatUpload = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        bpm: '', // int
        key: '',
        genre: '',
        price: '', // decimal - MP3 Lease price
        price_wav: '', // decimal - WAV Lease price
        price_exclusive: '', // decimal - Exclusive price
        currency: 'USD',
        description: '',
    });
    const [files, setFiles] = useState({
        audio: null,
        cover: null
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setFiles({ ...files, [e.target.name]: e.target.files[0] });
    };

    const slugify = (text) => {
        return text.toString().toLowerCase()
            .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
            .replace(/\s+/g, '_')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '_')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    };


    const handleUpload = async (e) => {
        e.preventDefault();
        if (!user) return alert('Please login to upload');
        if (!files.audio) return alert('Audio file is required');

        // File Size Checks
        const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20MB
        if (files.audio.size > MAX_AUDIO_SIZE) {
            return alert('Audio file too large. Max 20MB allowed.');
        }

        if (files.cover) {
            const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
            if (files.cover.size > MAX_IMAGE_SIZE) {
                return alert('Cover image too large. Max 2MB allowed.');
            }
        }

        setLoading(true);

        try {
            // 1. Upload Audio
            const sanitizedAudioName = slugify(files.audio.name.split('.')[0]) + '.' + files.audio.name.split('.').pop();
            const audioName = `${user.id}/${Date.now()}_${sanitizedAudioName}`;
            const { data: audioData, error: audioError } = await supabase.storage
                .from('beat-files')
                .upload(audioName, files.audio);

            if (audioError) throw audioError;

            const audioUrl = supabase.storage.from('beat-files').getPublicUrl(audioName).data.publicUrl;

            // 2. Upload Cover (Optional)
            let coverUrl = null;
            if (files.cover) {
                const sanitizedCoverName = slugify(files.cover.name.split('.')[0]) + '.' + files.cover.name.split('.').pop();
                const coverName = `${user.id}/${Date.now()}_${sanitizedCoverName}`;
                const { data: coverData, error: coverError } = await supabase.storage
                    .from('cover-arts')
                    .upload(coverName, files.cover);

                if (coverError) throw coverError;
                coverUrl = supabase.storage.from('cover-arts').getPublicUrl(coverName).data.publicUrl;
            }

            // 3. Insert Record with multi-license pricing
            const { error: insertError } = await supabase.from('beats').insert({
                producer_id: user.id,
                title: formData.title,
                bpm: parseInt(formData.bpm),
                key: formData.key,
                genre: formData.genre,
                price: parseFloat(formData.price) || 19.99,         // MP3 Lease
                price_wav: parseFloat(formData.price_wav) || 29.99,  // WAV Lease
                price_exclusive: parseFloat(formData.price_exclusive) || 149.99, // Exclusive
                currency: formData.currency,
                description: formData.description,
                audio_url: audioUrl,
                cover_url: coverUrl
            });

            if (insertError) throw insertError;

            alert('Beat uploaded successfully!');
            navigate('/profile');
        } catch (err) {
            console.error(err);
            alert('Upload failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pt-24 pb-24 container mx-auto px-6 max-w-2xl">
            <h1 className="text-3xl font-heading font-bold mb-8 flex items-center gap-3">
                <Upload className="text-primary" /> Upload New Beat
            </h1>

            <form onSubmit={handleUpload} className="space-y-6 bg-surface p-8 rounded-2xl border border-white/5 shadow-2xl">

                {/* Title */}
                <div className="space-y-2">
                    <label className="label-text">Title</label>
                    <input type="text" name="title" required className="input-field" placeholder="e.g. Midnight Drive" onChange={handleChange} />
                </div>

                {/* File Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="label-text flex items-center gap-2"><Music size={16} /> Audio File (MP3)</label>
                        <input type="file" name="audio" accept=".mp3" required onChange={handleFileChange} className="text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-red-600 cursor-pointer" />
                    </div>
                    <div className="space-y-2">
                        <label className="label-text">Cover Art (Image)</label>
                        <input type="file" name="cover" accept="image/*" onChange={handleFileChange} className="text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer" />
                    </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="label-text">BPM</label>
                        <input type="number" name="bpm" required min="0" className="input-field" placeholder="140" onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <label className="label-text">Key</label>
                        <input type="text" name="key" className="input-field" placeholder="C min" onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <label className="label-text">Genre</label>
                        <input type="text" name="genre" className="input-field" placeholder="Trap" onChange={handleChange} />
                    </div>
                </div>

                {/* Pricing - Multi-License (MP3, WAV, Exclusive) */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <DollarSign size={18} className="text-primary" /> License Pricing
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2 bg-neutral-900/50 p-4 rounded-xl border border-white/5">
                            <label className="label-text text-xs">MP3 Lease</label>
                            <input type="number" name="price" required min="1" step="0.01" className="input-field" placeholder="19.99" onChange={handleChange} />
                            <p className="text-xs text-neutral-500">Basic lease, MP3 format</p>
                        </div>
                        <div className="space-y-2 bg-neutral-900/50 p-4 rounded-xl border border-white/5">
                            <label className="label-text text-xs">WAV Lease</label>
                            <input type="number" name="price_wav" min="1" step="0.01" className="input-field" placeholder="29.99" onChange={handleChange} />
                            <p className="text-xs text-neutral-500">Higher quality WAV file</p>
                        </div>
                        <div className="space-y-2 bg-neutral-900/50 p-4 rounded-xl border border-primary/30">
                            <label className="label-text text-xs text-primary">Exclusive Rights</label>
                            <input type="number" name="price_exclusive" min="1" step="0.01" className="input-field" placeholder="149.99" onChange={handleChange} />
                            <p className="text-xs text-neutral-500">Full ownership transfer</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="label-text">Description</label>
                    <textarea name="description" className="input-field h-24 resize-none" placeholder="Tell us about the track..." onChange={handleChange}></textarea>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : 'Publish Beat'}
                </button>

            </form>
        </div>
    );
};

const labelText = "text-sm font-bold text-neutral-400 uppercase tracking-wider";

export default BeatUpload;
