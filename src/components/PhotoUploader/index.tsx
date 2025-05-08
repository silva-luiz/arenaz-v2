import { ChangeEvent } from 'react';
import { Button, styled } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Image from 'next/image';

interface IPhotoUploader {
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  arenaFile: File | null;
  preview: string;
  title: string;
  defaultImage?: string;
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
  title,
  defaultImage,
}: IPhotoUploader) {
  const imageToShow = preview || defaultImage || '/images/placeholder.jpg';

  return (
    <div className="flex flex-col cursor-pointer items-center">
      <div style={{ margin: '10px 0' }}>
        <Image src={imageToShow} alt="preview" width={200} height={200} />
      </div>

      <Button
        className="w-full"
        component="label"
        role={undefined}
        variant="contained"
        tabIndex={-1}
        endIcon={<CloudUploadIcon />}
      >
        {title}
        <VisuallyHiddenInput type="file" onChange={handleFileUpload} />
      </Button>

      {arenaFile && <span>{arenaFile.name}</span>}
    </div>
  );
}
