import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import { Camera, Spinner, Trash, MagnifyingGlassPlus } from '@phosphor-icons/react';
import type { PhotoItem } from '../../types';

interface PhotoUploadProps {
    photos: PhotoItem[];
    path: string; // Storage path e.g. users/uid/projects/pid/photos
    onUpdate: (newPhotos: PhotoItem[]) => void;
    isEditing: boolean;
}

import imageCompression from 'browser-image-compression';

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ photos, path, onUpdate, isEditing }) => {
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setUploading(true);

        try {
            const files = Array.from(e.target.files);

            const uploadPromises = files.map(async (file) => {
                // Compression options
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                };

                try {
                    // Compress the image
                    const compressedFile = await imageCompression(file, options);

                    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, compressedFile);
                    const url = await getDownloadURL(snapshot.ref);

                    return {
                        url,
                        caption: 'Foto',
                        storagePath: snapshot.ref.fullPath
                    };
                } catch (error) {
                    console.error(`Error processing file ${file.name}:`, error);
                    throw error;
                }
            });

            const newItems = await Promise.all(uploadPromises);
            onUpdate([...photos, ...newItems]);

        } catch (error) {
            alert("Erro ao enviar foto(s). Verifique sua conexão e tente novamente.");
            console.error(error);
        } finally {
            setUploading(false);
            // Clear input
            e.target.value = '';
        }
    };

    const removePhoto = (index: number) => {
        if (confirm("Apagar foto?")) {
            const copy = [...photos];
            copy.splice(index, 1);
            onUpdate(copy);
            // Optional: Delete from storage
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100 shadow-sm">
                        <img src={photo.url} className="w-full h-full object-cover" loading="lazy" />

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <button onClick={() => window.open(photo.url, '_blank')} className="p-2 bg-white/90 rounded-full text-blue-600 shadow-sm">
                                <MagnifyingGlassPlus size={20} weight="bold" />
                            </button>
                            {isEditing && (
                                <button onClick={() => removePhoto(index)} className="p-2 bg-white/90 rounded-full text-red-500 shadow-sm">
                                    <Trash size={20} weight="bold" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {isEditing && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-blue-200 flex flex-col items-center justify-center gap-2 text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                        {uploading ? <Spinner className="animate-spin" size={24} /> : <Camera size={24} weight="bold" />}
                        <span className="text-xs font-bold">{uploading ? 'Enviando...' : 'Adicionar Foto'}</span>
                        <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
                    </label>
                )}
            </div>
        </div>
    );
};
