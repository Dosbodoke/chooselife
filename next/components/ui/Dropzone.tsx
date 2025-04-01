import Image from "next/image";
import React from "react";

import { UploadCloudIcon } from "@/assets";
import { ACCEPTED_IMAGE_TYPES } from "@/utils/supabase/constants";

interface Props {
  id: string;
  label: string;
  errorMessage?: string;
  file?: Blob;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function Dropzone({ id, label, errorMessage, file, onChange }: Props) {
  return (
    <>
      {file ? (
        <div className="relative h-64 w-full">
          <Image
            src={URL.createObjectURL(file)}
            alt="Preview"
            fill
            className="rounded-lg object-cover"
          />
        </div>
      ) : (
        <label
          htmlFor={id}
          className="dark:hover:bg-bray-800 flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"
        >
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <UploadCloudIcon className="mb-3 h-10 w-10 text-gray-400" />
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold">{label}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PNG ou JPG
            </p>
          </div>
          <input
            id={id}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(", ")}
            onChange={onChange}
            className="hidden"
          />
          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-500">
              {errorMessage}
            </p>
          )}
        </label>
      )}
    </>
  );
}

export default Dropzone;
