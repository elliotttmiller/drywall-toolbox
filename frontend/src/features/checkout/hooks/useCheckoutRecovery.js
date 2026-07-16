import { useCallback, useState } from 'react';

import {
	clearPendingCheckoutPayment,
	makeCheckoutAttemptId,
	readPendingCheckoutPayment,
	writePendingCheckoutPayment,
} from '../../../utils/checkoutRecovery.js';

export function useCheckoutRecovery() {
	const [pendingPayment, setPendingPayment] = useState( () => readPendingCheckoutPayment() );

	const rememberPayment = useCallback( ( payload ) => {
		const recovery = writePendingCheckoutPayment( { ...payload, attemptId: payload?.attemptId || makeCheckoutAttemptId() } );
		setPendingPayment( recovery );
		return recovery;
	}, [] );

	const dismissPayment = useCallback( () => {
		clearPendingCheckoutPayment();
		setPendingPayment( null );
	}, [] );

	const resumePayment = useCallback( async () => {
		clearPendingCheckoutPayment();
		setPendingPayment( null );
		throw Object.assign(
			new Error( 'Legacy order-pay resume has been retired. Start checkout again so payment remains inside the same-shell WooPayments flow.' ),
			{ code: 'dtb_legacy_resume_retired' },
		);
	}, [] );

	return { pendingPayment, rememberPayment, dismissPayment, resumePayment };
}

export default useCheckoutRecovery;
