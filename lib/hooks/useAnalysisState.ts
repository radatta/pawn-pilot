import { useState, useEffect } from 'react';
import { PlyAnalysis } from '@/lib/queries/game-analysis-tanstack';

export type AnalysisState =
    | 'idle'           // Initial state, no analysis needed or started
    | 'loading-data'   // Loading existing analysis data from the server
    | 'backfilling-engine' // Running Stockfish to fill missing engine data
    | 'waiting-llm'    // Waiting for LLM to generate explanations
    | 'complete'       // All moves have engine data and explanations
    | 'error';         // Something went wrong

interface UseAnalysisStateProps {
    gameId: string | null | undefined;
    analysis: PlyAnalysis[] | undefined | null;
    sanHistory: string[];
    isLoading: boolean;
    error: Error | null;
}

export function useAnalysisState({
    gameId,
    analysis,
    sanHistory,
    isLoading,
    error
}: UseAnalysisStateProps) {
    const [state, setState] = useState<AnalysisState>('idle');

    // Determine if analysis has all required engine data
    const hasAllEngineData = analysis && analysis.length > 0 &&
        analysis.every(move => move.best_move && move.pv);

    // Determine if analysis has all explanations
    const hasAllExplanations = analysis && analysis.length > 0 &&
        analysis.every(move => move.explanation && move.explanation.trim() !== '');

    // Determine if analysis is complete (both engine data and explanations)
    const isComplete = hasAllEngineData && hasAllExplanations;

    // Track if we've triggered the LLM analysis
    const [llmTriggered, setLlmTriggered] = useState(false);

    // Reset state when gameId changes
    useEffect(() => {
        setState('idle');
        setLlmTriggered(false);
    }, [gameId]);

    // State machine transitions
    useEffect(() => {
        if (error) {
            setState('error');
            return;
        }

        if (isLoading) {
            setState('loading-data');
            return;
        }

        // If no game ID or no moves, we're idle
        if (!gameId || sanHistory.length === 0) {
            setState('idle');
            return;
        }

        // If analysis is complete, we're done
        if (isComplete) {
            setState('complete');
            return;
        }

        // If we have all engine data but not all explanations
        if (hasAllEngineData && !hasAllExplanations) {
            setState('waiting-llm');
            return;
        }

        // If we have analysis records but missing engine data
        if (analysis && analysis.length > 0 && !hasAllEngineData) {
            setState('backfilling-engine');
            return;
        }

        // If we have moves but no analysis records
        if (sanHistory.length > 0 && (!analysis || analysis.length === 0)) {
            setState('backfilling-engine');
            return;
        }
    }, [gameId, analysis, sanHistory, isLoading, error, isComplete, hasAllEngineData, hasAllExplanations]);

    // Track if LLM has been triggered for this analysis state
    useEffect(() => {
        if (state === 'waiting-llm') {
            setLlmTriggered(true);
        } else if (state === 'idle' || state === 'loading-data') {
            setLlmTriggered(false);
        }
    }, [state]);

    return {
        state,
        isComplete,
        hasAllEngineData,
        hasAllExplanations,
        llmTriggered,
        setLlmTriggered
    };
} 