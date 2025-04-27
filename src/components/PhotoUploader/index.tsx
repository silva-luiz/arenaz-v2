import { ChangeEvent } from 'react';
import { Button, styled } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Image from 'next/image';

interface IPhotoUploader {
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  arenaFile: File | null;
  preview: string;
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export default function PhotoUploader({
  handleFileUpload,
  arenaFile,
  preview,
}: IPhotoUploader) {
  return (
    <div className="flex flex-col cursor-pointer items-center">
      {preview && (
        <div style={{ margin: '10px 0' }}>
          <Image src={preview} alt="preview" width={200} height={200} />
        </div>
      )}
      <Button
        className="w-full"
        component="label"
        role={undefined}
        variant="contained"
        tabIndex={-1}
        startIcon={<CloudUploadIcon />}
      >
        Upload files
        <VisuallyHiddenInput type="file" onChange={handleFileUpload} />
      </Button>
      {arenaFile && <span>{arenaFile.name}</span>}
    </div>
  );
}
