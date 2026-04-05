import { useEffect, useState } from 'react'

interface Location {
  lat: number
  lng: number
}

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; location: Location }
  | { status: 'error'; message: string }

const DEFAULT_LOCATION: Location = { lat: 52.2297, lng: 21.0122 } // Warszawa

export function useUserLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ status: 'success', location: DEFAULT_LOCATION })
      return
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: 'success',
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        })
      },
      () => {
        setState({ status: 'success', location: DEFAULT_LOCATION })
      },
      { enableHighAccuracy: true, timeout: 5000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const location =
    state.status === 'success' ? state.location : DEFAULT_LOCATION

  return { location, isLoading: state.status === 'loading' }
}
