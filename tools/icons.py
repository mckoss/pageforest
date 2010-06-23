#!/usr/bin/env python

import os
import sys
from PIL import Image, ImageDraw

RADIUS_PERCENT = 15


def rounded_corners(image, alpha, radius):
    white = Image.new('RGB', image.size, 'white')
    image = Image.composite(image, white, alpha)
    size = image.size[0]
    draw = ImageDraw.Draw(alpha)
    draw.rectangle([0, radius, size, size - radius], fill=255)
    draw.rectangle([radius, 0, size - radius, size], fill=255)
    for x1 in (0, size - 2 * radius):
        for y1 in (0, size - 2 * radius):
            x2 = x1 + 2 * radius
            y2 = y1 + 2 * radius
            draw.ellipse([x1, y1, x2, y2], fill=255)
    image.putalpha(alpha)
    return image


def main():
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    elif os.path.exists('images/logo.png'):
        filename = 'images/logo.png'
    else:
        sys.exit('usage: icons.py filename.png [size] ...')
    sizes = map(int, sys.argv[2:])
    if not sizes:
        sizes = (64, 114)  # (16, 32, 48, 57, 64, 72, 114)
    source = Image.open(filename)
    for size in sizes:
        if size == 64:
            outfilename = 'favicon.png'
        elif size == 114:
            outfilename = 'apple-touch-icon.png'
        else:
            outfilename = 'favicon%d.png' % size
        image = source.copy()
        if size in (57, 72, 114):
            channels = image.split()
            if len(channels) in (2, 4):
                image = rounded_corners(
                    image, alpha=channels[-1],
                    radius=RADIUS_PERCENT * source.size[0] / 100)
        image = image.resize((size, size), Image.ANTIALIAS)
        image.save(outfilename)
        print '%s (%d colors, %d bytes)' % (
            outfilename,
            len(image.getcolors(size * size)),
            os.path.getsize(outfilename))
    print """
<link rel="icon" type="image/png" href="favicon.png" />
<link rel="apple-touch-icon-precomposed" href="apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="translucent" />
""".strip()


if __name__ == '__main__':
    main()
