"use client";

import { ToastContainer as _ToastContainer, toast as _toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const toast = {
  success: (message: string) => _toast.success(message),
  error: (message: string) => _toast.error(message),
};

export function ToastContainer() {
  return (
    <_ToastContainer
      position="bottom-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme="light"
    />
  );
}
