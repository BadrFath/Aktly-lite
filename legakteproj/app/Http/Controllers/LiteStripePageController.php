<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LiteStripePageController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $langue = in_array($user->langue_user ?? null, ['fr', 'nl'], true) ? $user->langue_user : 'fr';

        return response()->json([
            'page' => 'stripe',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'credits' => $user->credits ?? 0,
                'langue_user' => $langue,
            ],
            'packs' => [
                ['slug' => 'starter-10', 'credits' => 10],
                ['slug' => 'pro-50', 'credits' => 50],
                ['slug' => 'business-100', 'credits' => 100],
            ],
            'endpoints' => [
                'checkout' => url('/lite/stripe/checkout/{slug}'),
                'invoices' => url('/lite/stripe/invoices'),
                'receipts' => url('/lite/stripe/receipts'),
                'success' => url('/lite/stripe/success'),
                'cancel' => url('/lite/stripe/cancel'),
            ],
        ]);
    }
}

