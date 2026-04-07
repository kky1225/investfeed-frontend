import {createContext, useContext, useState, ReactNode} from 'react';

interface BlindModeContextType {
    isBlind: boolean;
    toggleBlind: () => void;
}

const BlindModeContext = createContext<BlindModeContextType>({
    isBlind: false,
    toggleBlind: () => {},
});

export function BlindModeProvider({children}: { children: ReactNode }) {
    const [isBlind, setIsBlind] = useState(false);

    const toggleBlind = () => setIsBlind(prev => !prev);

    return (
        <BlindModeContext.Provider value={{isBlind, toggleBlind}}>
            {children}
        </BlindModeContext.Provider>
    );
}

export const useBlindMode = () => useContext(BlindModeContext);
