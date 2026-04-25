import { auth } from '@/lib/auth';
import { OnboardingService } from '@/services/core/system/onboarding.service';
import { TutorialManager } from './tutorial-manager';

export async function TutorialWrapper() {
    const session = await auth();
    const shopId = session?.user?.shopId;

    if (!shopId) return null;

    try {
        const state = await OnboardingService.getTutorialState(shopId);

        if (!state || state.tutorialDismissed) return null;

        return (
            <TutorialManager
                initialTrack={state.tutorialTrack ?? 1}
                initialStep={state.tutorialStep ?? 1}
                isDismissed={state.tutorialDismissed ?? false}
            />
        );
    } catch (error) {
        console.error('TutorialWrapper error:', error);
        return null;
    }
}
