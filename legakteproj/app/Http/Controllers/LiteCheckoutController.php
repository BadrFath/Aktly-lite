<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LiteCheckoutController extends Controller
{
    private const PACKS = [
        'starter-10' => ['credits' => 10],
        'pro-50' => ['credits' => 50],
        'business-100' => ['credits' => 100],
    ];

    public function create(Request $request, string $slug)
    {
        abort_unless(isset(self::PACKS[$slug]), 404, 'Pack inconnu');

        return response()->json([
            'ok' => true,
            'slug' => $slug,
            'credits' => self::PACKS[$slug]['credits'],
            'url' => url('/lite/stripe/success?pack='.$slug),
        ]);
    }

    public function success(Request $request)
    {
        return response()->json([
            'ok' => true,
            'message' => 'Paiement confirme',
            'pack' => $request->query('pack'),
        ]);
    }

    public function cancel()
    {
        return response()->json(['cancelled' => true]);
    }

    public function handleWebhook(Request $request)
    {
        return response()->json(['received' => true]);
    }
}

