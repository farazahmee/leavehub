import { create } from 'zustand'

const useConnectionStore = create((set) => ({
  backendUnreachable: false,
  setBackendUnreachable: (value) => set({ backendUnreachable: value }),
}))

export default useConnectionStore
