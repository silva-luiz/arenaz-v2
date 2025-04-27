import { ChangeEvent } from 'react';
import { Button, styled } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface IPhotoUploader {
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  arenaFile: File | null;
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
}: IPhotoUploader) {
  return (
    <div className="flex flex-col cursor-pointer max-w-72 max-h-40 w-full h-full ">
      <Button
        component="label"
        role={undefined}
        variant="contained"
        tabIndex={-1}
        startIcon={<CloudUploadIcon />}
      >
        Upload files
        <VisuallyHiddenInput type="file" onChange={handleFileUpload} />
      </Button>
      <span>Test{arenaFile && arenaFile.name}</span>
    </div>
  );
}
